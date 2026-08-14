import { createHash } from 'node:crypto';
import pg from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import type {
  AdapterConfig,
  CaptureOutcome,
  FinishRunInput,
  IngestionStore,
  NormalizedSourceRecord,
  ProjectionOutcome,
  ResolutionOutcome,
  SourceEvidenceExecution,
  SourceObservation,
  StartRunInput,
} from './types.ts';

const { Client, Pool } = pg;
export const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export class PostgresIngestionStore implements IngestionStore {
  readonly #pool: pg.Pool;

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString, max: 8 });
  }

  async startRun(input: StartRunInput): Promise<string> {
    return this.#withRole(async (client) => {
      const result = await client.query<{ id: string }>(`
        insert into app.ingestion_runs (
          idempotency_key, source_id, scope_id, adapter_version, parser_version,
          mapping_version, retry_of_run_id, snapshot_key
        )
        select $1, source.id, scope.id, $2, $3, $4, $5, $6
        from app.sources as source
        cross join app.geographic_scopes as scope
        where source.key = $7 and source.enabled
          and scope.slug = $8 and scope.is_active
        returning id
      `, [
        input.idempotencyKey,
        input.config.adapterVersion,
        input.config.parserVersion,
        input.config.mappingVersion,
        input.retryOfRunId,
        input.snapshotKey,
        input.config.sourceKey,
        input.config.scopeSlug,
      ]);
      if (result.rowCount !== 1) {
        throw new Error('enabled source and active scope are required before starting ingestion');
      }
      return result.rows[0].id;
    });
  }

  async capture(
    runId: string,
    config: AdapterConfig,
    observation: SourceObservation,
    envelope: Record<string, unknown>,
  ): Promise<CaptureOutcome> {
    const contentHash = sha256(canonicalJson(envelope));
    return this.#transaction(async (client) => {
      const insertedRecord = await client.query<{ id: string }>(`
        insert into app.source_records (
          source_id, external_key, canonical_url, first_seen_at, last_seen_at
        )
        select source.id, $1, $2, $3, $3
        from app.sources as source
        where source.key = $4
        on conflict (source_id, external_key) do nothing
        returning id
      `, [observation.externalKey, observation.sourceUrl, observation.observedAt, config.sourceKey]);

      const record = await one<{
        id: string;
        current_version_id: string | null;
        current_parse_attempt_id: string | null;
        selected_parser_version: string | null;
        persistence_permission: string;
      }>(client, `
        select record.id, record.current_version_id, record.current_parse_attempt_id,
               attempt.parser_version as selected_parser_version,
               source.persistence_permission
        from app.source_records as record
        join app.sources as source on source.id = record.source_id
        left join app.source_record_parse_attempts as attempt
          on attempt.id = record.current_parse_attempt_id
        where source.key = $1 and record.external_key = $2
        for update of record
      `, [config.sourceKey, observation.externalKey]);

      await client.query(`
        update app.source_records
        set last_seen_at = greatest(last_seen_at, $2::timestamptz),
            canonical_url = coalesce($3, canonical_url),
            is_missing = false,
            miss_count = 0
        where id = $1
      `, [record.id, observation.observedAt, observation.sourceUrl]);

      const insertedVersion = await client.query<{ id: string }>(`
        insert into app.source_record_versions (
          source_record_id, capture_run_id, content_hash, payload,
          payload_storage_mode, source_url, http_etag, http_last_modified,
          fetched_at, observed_at
        ) values ($1, $2, $3, $4::jsonb, $10, $5, $6, $7, $8, $9)
        on conflict (source_record_id, content_hash) do nothing
        returning id
      `, [
        record.id,
        runId,
        contentHash,
        JSON.stringify(envelope),
        observation.sourceUrl,
        observation.httpEtag ?? null,
        observation.httpLastModified ?? null,
        observation.fetchedAt,
        observation.observedAt,
        payloadStorageMode(record.persistence_permission),
      ]);

      const versionId = insertedVersion.rows[0]?.id ?? (await one<{ id: string }>(client, `
        select id from app.source_record_versions
        where source_record_id = $1 and content_hash = $2
      `, [record.id, contentHash])).id;

      return {
        sourceRecordId: record.id,
        sourceRecordVersionId: versionId,
        classification: insertedRecord.rowCount === 1
          ? 'NEW'
          : insertedVersion.rowCount === 1 ? 'CHANGED' : 'UNCHANGED',
        contentHash,
        expectedCurrentVersionId: record.current_version_id,
        expectedCurrentParseAttemptId: record.current_parse_attempt_id,
        selectedParserVersion: record.selected_parser_version,
      };
    });
  }

  async beginParseAttempt(runId: string, versionId: string, parserVersion: string): Promise<string> {
    return this.#transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(`
        insert into app.source_record_parse_attempts (
          source_record_version_id, ingestion_run_id, parser_version
        ) values ($1, $2, $3)
        on conflict (source_record_version_id, parser_version, ingestion_run_id) do nothing
        returning id
      `, [versionId, runId, parserVersion]);
      if (inserted.rowCount === 1) return inserted.rows[0].id;

      const existing = await one<{ id: string; status: string }>(client, `
        select id, status from app.source_record_parse_attempts
        where source_record_version_id = $1 and ingestion_run_id = $2 and parser_version = $3
      `, [versionId, runId, parserVersion]);
      if (existing.status !== 'STARTED') {
        throw new Error('terminal parse attempt cannot be resumed');
      }
      return existing.id;
    });
  }

  async failParseAttempt(attemptId: string, errorClass: string, errorCode: string): Promise<void> {
    await this.#transaction(async (client) => {
      const result = await client.query(`
        update app.source_record_parse_attempts
        set status = 'FAILED', finished_at = now(), error_class = $2, error_code = $3
        where id = $1 and status = 'STARTED'
      `, [attemptId, errorClass, errorCode]);
      if (result.rowCount !== 1) throw new Error('parse attempt is no longer STARTED');
    });
  }

  async succeedParseAttemptAndSelect(input: {
    runId: string;
    parserVersion: string;
    attemptId: string;
    capture: CaptureOutcome;
    normalized: NormalizedSourceRecord;
  }): Promise<SourceEvidenceExecution> {
    const output = canonicalJson(input.normalized);
    await this.#transaction(async (client) => {
      const result = await client.query(`
        update app.source_record_parse_attempts
        set status = 'SUCCEEDED', finished_at = now(), normalized_output = $2::jsonb,
            normalized_output_hash = $3
        where id = $1 and status = 'STARTED'
      `, [input.attemptId, output, sha256(output)]);
      if (result.rowCount !== 1) throw new Error('parse attempt is no longer STARTED');
    });

    await this.#transaction(async (client) => {
      await client.query(`
        select app.select_source_record_current_evidence($1, $2, $3, $4, $5, $6, $7)
      `, [
        input.capture.sourceRecordId,
        input.capture.sourceRecordVersionId,
        input.attemptId,
        input.runId,
        input.parserVersion,
        input.capture.expectedCurrentVersionId,
        input.capture.expectedCurrentParseAttemptId,
      ]);
    });

    return {
      sourceRecordId: input.capture.sourceRecordId,
      sourceRecordVersionId: input.capture.sourceRecordVersionId,
      sourceRecordParseAttemptId: input.attemptId,
    };
  }

  async resolve(
    evidence: SourceEvidenceExecution,
    candidate: NormalizedSourceRecord,
  ): Promise<ResolutionOutcome> {
    return this.#transaction(async (client) => {
      await assertCurrentEvidence(client, evidence);
      const record = await one<{ canonical_entity_id: string | null }>(client, `
        select canonical_entity_id from app.source_records where id = $1
      `, [evidence.sourceRecordId]);
      if (record.canonical_entity_id) {
        return { kind: 'EXISTING', canonicalEntityId: record.canonical_entity_id };
      }
      return candidate.place.resolution === 'UNRESOLVED' ? { kind: 'UNRESOLVED' } : { kind: 'NEW' };
    });
  }

  async readSelectedNormalized(evidence: SourceEvidenceExecution): Promise<NormalizedSourceRecord> {
    return this.#transaction(async (client) => {
      await assertCurrentEvidence(client, evidence);
      const attempt = await one<{ normalized_output: unknown }>(client, `
        select normalized_output from app.source_record_parse_attempts where id = $1
      `, [evidence.sourceRecordParseAttemptId]);
      if (!isNormalizedSourceRecord(attempt.normalized_output)) {
        throw new Error('selected parse attempt has an incompatible normalized output contract');
      }
      return attempt.normalized_output;
    });
  }

  async applyCanonical(input: {
    evidence: SourceEvidenceExecution;
    candidate: NormalizedSourceRecord;
    mappingVersion: string;
    beforeCommit: () => Promise<ProjectionOutcome>;
  }): Promise<{
    canonicalEntityId: string;
    canonicalChanged: boolean;
    projection: ProjectionOutcome | null;
  }> {
    return this.#transaction(async (client) => {
      await assertCurrentEvidence(client, input.evidence);
      const assignment = await one<{
        canonical_entity_id: string | null;
        scope_id: string;
        boundary_id: string;
      }>(client, `
        select record.canonical_entity_id, scope.id as scope_id, boundary.id as boundary_id
        from app.source_records as record
        join app.ingestion_runs as run on run.id = (
          select attempt.ingestion_run_id
          from app.source_record_parse_attempts as attempt
          where attempt.id = $2
        )
        join app.geographic_scopes as scope on scope.id = run.scope_id
        join app.geographic_scope_boundaries as boundary
          on boundary.scope_id = scope.id and boundary.is_active
        where record.id = $1
        for update of record
      `, [input.evidence.sourceRecordId, input.evidence.sourceRecordParseAttemptId]);

      const covered = await one<{ covered: boolean }>(client, `
        select extensions.st_covers(
          boundary,
          extensions.st_setsrid(extensions.st_makepoint($2, $1), 4326)
        ) as covered
        from app.geographic_scope_boundaries where id = $3
      `, [input.candidate.place.latitude, input.candidate.place.longitude, assignment.boundary_id]);
      if (!covered.covered) throw new Error('fixture candidate is outside the configured active boundary');

      const canonicalName = input.candidate.place.canonicalName;
      const canonicalNameNorm = normalizeName(canonicalName);
      const canonicalNameAscii = accentless(canonicalNameNorm);
      let canonicalEntityId = assignment.canonical_entity_id;
      let canonicalChanged: boolean;

      if (canonicalEntityId === null) {
        canonicalEntityId = (await one<{ id: string }>(client, `
          insert into app.canonical_entities (
            entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
            scope_id, scope_boundary_id
          ) values ('PLACE', $1, $2, $3, $4, $5)
          returning id
        `, [canonicalName, canonicalNameNorm, canonicalNameAscii, assignment.scope_id, assignment.boundary_id])).id;
        canonicalChanged = true;

        await client.query(`
          insert into app.places (
            entity_id, location, street_address, postal_code, locality, status,
            official_url, phone, opening_hours, last_authoritative_observed_at
          ) values (
            $1, extensions.st_setsrid(extensions.st_makepoint($3, $2), 4326)::extensions.geography,
            $4, $5, $6, $7, $8, $9, $10::jsonb, $11
          )
        `, [
          canonicalEntityId,
          input.candidate.place.latitude,
          input.candidate.place.longitude,
          input.candidate.place.streetAddress ?? null,
          input.candidate.place.postalCode ?? null,
          input.candidate.place.locality ?? null,
          input.candidate.place.status,
          input.candidate.place.officialUrl ?? null,
          input.candidate.place.phone ?? null,
          input.candidate.place.openingHours ? JSON.stringify(input.candidate.place.openingHours) : null,
          input.candidate.observedAt,
        ]);
        await client.query(`
          update app.source_records
          set canonical_entity_id = $2, resolution_method = 'NEW_CANONICAL'
          where id = $1
        `, [input.evidence.sourceRecordId, canonicalEntityId]);
      } else {
        const canonicalUpdate = await client.query(`
          update app.canonical_entities
          set canonical_name = $2, canonical_name_norm = $3, canonical_name_ascii = $4
          where id = $1
            and (canonical_name, canonical_name_norm, canonical_name_ascii)
              is distinct from ($2, $3, $4)
        `, [canonicalEntityId, canonicalName, canonicalNameNorm, canonicalNameAscii]);
        const placeUpdate = await client.query(`
          update app.places
          set location = extensions.st_setsrid(extensions.st_makepoint($3, $2), 4326)::extensions.geography,
              street_address = $4, postal_code = $5, locality = $6, status = $7,
              official_url = $8, phone = $9, opening_hours = $10::jsonb,
              last_authoritative_observed_at = $11
          where entity_id = $1
            and (
              location, street_address, postal_code, locality, status, official_url,
              phone, opening_hours,
              last_authoritative_observed_at
            ) is distinct from (
              extensions.st_setsrid(extensions.st_makepoint($3, $2), 4326)::extensions.geography,
              $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz
            )
        `, [
          canonicalEntityId,
          input.candidate.place.latitude,
          input.candidate.place.longitude,
          input.candidate.place.streetAddress ?? null,
          input.candidate.place.postalCode ?? null,
          input.candidate.place.locality ?? null,
          input.candidate.place.status,
          input.candidate.place.officialUrl ?? null,
          input.candidate.place.phone ?? null,
          input.candidate.place.openingHours ? JSON.stringify(input.candidate.place.openingHours) : null,
          input.candidate.observedAt,
        ]);
        canonicalChanged = canonicalUpdate.rowCount === 1 || placeUpdate.rowCount === 1;
      }

      if (input.candidate.place.taxonomySlug) {
        const node = await one<{ id: string }>(client, `
          select id from app.taxonomy_nodes
          where taxonomy_version = 'active-going-out.v1' and slug = $1 and active
        `, [input.candidate.place.taxonomySlug]);
        const currentMembership = await maybeOne<{ id: string; source_record_version_id: string | null }>(client, `
          select id, source_record_version_id from app.entity_taxonomy_memberships
          where entity_id = $1 and taxonomy_node_id = $2 and active
          for update
        `, [canonicalEntityId, node.id]);
        if (currentMembership?.source_record_version_id !== input.evidence.sourceRecordVersionId) {
          if (currentMembership) {
            await client.query(`update app.entity_taxonomy_memberships set active = false where id = $1`, [currentMembership.id]);
          }
          await client.query(`
            insert into app.entity_taxonomy_memberships (
              entity_id, taxonomy_node_id, method, source_record_version_id, mapping_ref
            ) values ($1, $2, 'DETERMINISTIC_MAP', $3, $4)
          `, [
            canonicalEntityId,
            node.id,
            input.evidence.sourceRecordVersionId,
            `${input.mappingVersion}:${input.candidate.place.taxonomySlug}`,
          ]);
          canonicalChanged = true;
        }
      }

      await client.query('set constraints all immediate');
      const projection = canonicalChanged ? await input.beforeCommit() : null;
      return { canonicalEntityId, canonicalChanged, projection };
    });
  }

  async finishRun(input: FinishRunInput): Promise<number> {
    return this.#transaction(async (client) => {
      const run = await one<{ source_id: string; scope_id: string }>(client, `
        select source_id, scope_id from app.ingestion_runs
        where id = $1 and status = 'STARTED' for update
      `, [input.runId]);
      let disappeared = 0;
      if (
        input.status === 'SUCCEEDED'
        && input.refreshMode !== 'DELTA_ONLY'
        && input.refreshUnitComplete
        && input.snapshotComplete === true
      ) {
        const missing = await client.query<{ id: string }>(`
          select id from app.source_records
          where source_id = $1 and not (external_key = any($2::text[])) and not is_missing
            and exists (
              select 1
              from app.source_record_versions as version
              join app.ingestion_runs as capture_run on capture_run.id = version.capture_run_id
              where version.source_record_id = source_records.id
                and capture_run.scope_id = $3
            )
          for update
        `, [run.source_id, input.observedExternalKeys, run.scope_id]);
        disappeared = missing.rowCount ?? 0;
      }

      await client.query(`
        update app.ingestion_runs
        set status = $2, finished_at = now(), refresh_unit_complete = $3,
            snapshot_complete = $4, fetched = $5, valid = $6, invalid = $7,
            new_count = $8, changed = $9, unchanged = $10,
            unresolved_duplicates = $11, disappeared = $12, published = $13,
            error_code = $14, error_summary = $15::jsonb
        where id = $1
      `, [
        input.runId,
        input.status,
        input.refreshUnitComplete,
        input.snapshotComplete,
        input.counters.fetched,
        input.counters.valid,
        input.counters.invalid,
        input.counters.newCount,
        input.counters.changed,
        input.counters.unchanged,
        input.counters.unresolved,
        disappeared,
        input.counters.published,
        input.errorCode ?? null,
        input.errorCode ? JSON.stringify({ fatal: 1 }) : null,
      ]);

      if (disappeared > 0) {
        await client.query(`
          update app.source_records
          set miss_count = miss_count + 1, is_missing = true,
              last_complete_snapshot_run_id = $2
          where source_id = $1 and not (external_key = any($3::text[])) and not is_missing
            and exists (
              select 1
              from app.source_record_versions as version
              join app.ingestion_runs as capture_run on capture_run.id = version.capture_run_id
              where version.source_record_id = source_records.id
                and capture_run.scope_id = $4
            )
        `, [run.source_id, input.runId, input.observedExternalKeys, run.scope_id]);
      }
      return disappeared;
    });
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  async #withRole<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query('set role lemon_ingestion');
      return await operation(client);
    } finally {
      client.release();
    }
  }

  async #transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.#withRole(async (client) => {
      await client.query('begin');
      try {
        const result = await operation(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}

export async function ensureFixtureSource(
  connectionString: string,
  config: AdapterConfig,
): Promise<void> {
  await prepareLocalIngestionRuntime(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      insert into app.sources (
        key, name, kind, licence, attribution, persistence_permission,
        refresh_mode, adapter_version, enabled
      ) values ($1, $2, 'MANUAL', 'TEST-FIXTURE-ONLY',
        'ING-01 deterministic local fixture; not production inventory.',
        'FULL_PAYLOAD', $3, $4, true)
      on conflict (key) do update
      set name = excluded.name, refresh_mode = excluded.refresh_mode,
          adapter_version = excluded.adapter_version, enabled = true
    `, [config.sourceKey, config.sourceName, config.refreshMode, config.adapterVersion]);
  } finally {
    await client.end();
  }
}

export async function prepareLocalIngestionRuntime(connectionString: string): Promise<void> {
  assertLocalDatabase(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion to postgres with set true');
  } finally {
    await client.end();
  }
}

export function fixtureDatabaseUrl(): string {
  const connectionString = process.env.LEMON_LOCAL_DATABASE_URL ?? LOCAL_DATABASE_URL;
  assertLocalDatabase(connectionString);
  return connectionString;
}

function assertLocalDatabase(connectionString: string): void {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('fixture ingestion is restricted to a local database');
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE');
}

function accentless(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '');
}

function payloadStorageMode(permission: string): string {
  if (permission === 'FULL_PAYLOAD') return 'FULL_PAYLOAD';
  if (permission === 'EXTRACTED_FIELDS_ONLY') return 'EXTRACTED_ENVELOPE';
  if (permission === 'METADATA_ONLY') return 'METADATA_ENVELOPE';
  throw new Error(`unsupported source persistence permission: ${permission}`);
}

function isNormalizedSourceRecord(value: unknown): value is NormalizedSourceRecord {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<NormalizedSourceRecord>;
  return candidate.entityType === 'PLACE'
    && typeof candidate.externalKey === 'string'
    && candidate.place?.entityType === 'PLACE'
    && typeof candidate.place.canonicalName === 'string';
}

async function assertCurrentEvidence(client: PoolClient, evidence: SourceEvidenceExecution): Promise<void> {
  await client.query('select app.assert_source_record_current_evidence($1, $2, $3)', [
    evidence.sourceRecordId,
    evidence.sourceRecordVersionId,
    evidence.sourceRecordParseAttemptId,
  ]);
}

async function one<T extends QueryResultRow>(
  client: PoolClient,
  query: string,
  values: unknown[],
): Promise<T> {
  const result = await client.query<T>(query, values);
  if (result.rowCount !== 1) throw new Error('expected exactly one database row');
  return result.rows[0];
}

async function maybeOne<T extends QueryResultRow>(
  client: PoolClient,
  query: string,
  values: unknown[],
): Promise<T | null> {
  const result = await client.query<T>(query, values);
  if ((result.rowCount ?? 0) > 1) throw new Error('expected at most one database row');
  return result.rows[0] ?? null;
}
