import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_DOCUMENT_INPUT_TYPE,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROVIDER,
  EMBEDDING_QUERY_INPUT_TYPE,
  EmbeddingRequestError,
  requestVoyageEmbedding,
  validateEmbeddingVector,
} from './voyage-client.ts';

export * from './voyage-client.ts';

const { Client } = pg;

export const EMBEDDING_TIMEOUT_MS = 10_000;
export const EMBEDDING_CONFIG_VERSION = 'embed-01b-voyage-4-v1';
export const EMBEDDING_DOCUMENT_VERSION = 'search-document-v1';
export const EMBEDDING_DOCUMENT_TEMPLATE_VERSION = 'lexical-embedding-template-v1';
export const EMBEDDING_BATCH_SIZE = 8;
export const EMBEDDING_CORPUS_LIMIT = 500;
const MAX_ERROR_IDENTITY_LENGTH = 80;

export type EmbeddingContract = {
  provider: typeof EMBEDDING_PROVIDER;
  model: typeof EMBEDDING_MODEL;
  modelRevision: typeof EMBEDDING_MODEL_REVISION;
  dimension: typeof EMBEDDING_DIMENSION;
};
export type EmbeddingTarget = {
  documentId: string;
  entityId: string;
  entityType: 'PLACE' | 'EVENT';
  documentHash: string;
  embeddingText: string;
  displayName: string;
};
export type EmbeddingFailure = {
  errorClass: string;
  errorCode: string;
};
export type SelectedEmbeddingConfig = {
  version: typeof EMBEDDING_CONFIG_VERSION;
  provider: typeof EMBEDDING_PROVIDER;
  model: typeof EMBEDDING_MODEL;
  revision: typeof EMBEDDING_MODEL_REVISION;
  dimension: typeof EMBEDDING_DIMENSION;
  documentInputType: typeof EMBEDDING_DOCUMENT_INPUT_TYPE;
  queryInputType: typeof EMBEDDING_QUERY_INPUT_TYPE;
  documentVersion: typeof EMBEDDING_DOCUMENT_VERSION;
  documentTemplateVersion: typeof EMBEDDING_DOCUMENT_TEMPLATE_VERSION;
  batchSize: number;
  corpusLimit: number;
};
export type EmbeddingGenerationProgress = {
  processed: number;
  total: number;
  documentId: string;
  entityType: 'PLACE' | 'EVENT';
  outcome: 'READY' | 'FAILED';
};
export type EmbeddingGenerationReport = {
  selected: number;
  attempted: number;
  ready: number;
  failed: number;
  staleIncompatible: number;
};
export type EmbeddingTargetOperations = {
  requestEmbedding: (text: string) => Promise<number[]>;
  persistReady: (
    target: EmbeddingTarget,
    vector: number[],
    attempt: { attemptId: string; attemptedAt: Date },
  ) => Promise<void>;
  persistFailed: (
    target: EmbeddingTarget,
    failure: EmbeddingFailure,
    attempt: { attemptId: string; attemptedAt: Date },
  ) => Promise<void>;
};
export type EmbeddingCoverageReport = {
  selectedContract: {
    provider: string;
    model: string;
    revision: string;
    dimension: number;
    configVersion: string;
    documentInputType: string;
    queryInputType: string;
    documentVersion: string;
    documentTemplateVersion: string;
  };
  corpus: {
    activePlaceDocuments: number;
    activeEventDocuments: number;
    totalActive: number;
    eligible: number;
  };
  embeddingState: {
    compatibleReady: number;
    failedDocuments: number;
    failedAttempts: number;
    staleAttempts: number;
    missingUnattempted: number;
    incompatibleReady: number;
  };
  coveragePercentage: number;
  failures: Array<{
    id: string;
    attemptKey: string;
    errorClass: string;
    errorCode: string;
    documentId: string;
    documentHash: string;
    retryStatus: 'RETRY_AVAILABLE' | 'READY_ON_LATER_ATTEMPT';
  }>;
};

export const EMBEDDING_CONTRACT: EmbeddingContract = {
  provider: EMBEDDING_PROVIDER,
  model: EMBEDDING_MODEL,
  modelRevision: EMBEDDING_MODEL_REVISION,
  dimension: EMBEDDING_DIMENSION,
};

export function validateSelectedEmbeddingConfig(value: unknown): SelectedEmbeddingConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('selected embedding config must be an object');
  }
  const config = value as Record<string, unknown>;
  const expected = {
    version: EMBEDDING_CONFIG_VERSION,
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    revision: EMBEDDING_MODEL_REVISION,
    dimension: EMBEDDING_DIMENSION,
    documentInputType: EMBEDDING_DOCUMENT_INPUT_TYPE,
    queryInputType: EMBEDDING_QUERY_INPUT_TYPE,
    documentVersion: EMBEDDING_DOCUMENT_VERSION,
    documentTemplateVersion: EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
  } as const;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (config[key] !== expectedValue) {
      throw new Error(`selected embedding config has incompatible ${key}`);
    }
  }
  if (!Number.isInteger(config.batchSize)
    || (config.batchSize as number) < 1
    || (config.batchSize as number) > EMBEDDING_BATCH_SIZE) {
    throw new Error(`selected embedding batchSize must be between 1 and ${EMBEDDING_BATCH_SIZE}`);
  }
  if (!Number.isInteger(config.corpusLimit)
    || (config.corpusLimit as number) < 1
    || (config.corpusLimit as number) > EMBEDDING_CORPUS_LIMIT) {
    throw new Error(`selected embedding corpusLimit must be between 1 and ${EMBEDDING_CORPUS_LIMIT}`);
  }
  return config as SelectedEmbeddingConfig;
}

export function createAttemptKey(target: EmbeddingTarget, attemptId: string): string {
  if (!attemptId.trim()) throw new Error('attempt ID is required');
  return createHash('sha256').update(JSON.stringify({
    attemptId,
    documentId: target.documentId,
    documentHash: target.documentHash,
    ...EMBEDDING_CONTRACT,
  })).digest('hex');
}

export async function prepareLocalEmbeddingRuntime(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('embedding role preparation is restricted to a local database');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function selectEmbeddingSmokeTarget(connectionString: string): Promise<EmbeddingTarget> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query<{
      document_id: string;
      entity_id: string;
      entity_type: 'PLACE' | 'EVENT';
      document_hash: string;
      embedding_text: string;
      display_name: string;
    }>(`
      select document.id as document_id, document.entity_id, entity.entity_type,
             document.content_hash as document_hash,
             document.embedding_text, document.display_name
      from app.search_documents as document
      join app.canonical_entities as entity on entity.id = document.entity_id
      where document.is_active
        and document.embedding_text <> ''
        and entity.publication_status = 'PUBLISHED'
        and entity.merged_into_id is null
      order by (document.display_name = 'Evergreen Restaurang & Pizzeria') desc,
               document.entity_id
      limit 1
    `);
    const row = result.rows[0];
    if (!row) throw new Error('no active eligible SearchDocument is available for embedding smoke');
    return {
      documentId: row.document_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      documentHash: row.document_hash,
      embeddingText: row.embedding_text,
      displayName: row.display_name,
    };
  } finally {
    await client.end();
  }
}

export async function persistReadyEmbedding(
  connectionString: string,
  target: EmbeddingTarget,
  vector: number[],
  options: { attemptId?: string; attemptedAt?: Date; generatedAt?: Date } = {},
): Promise<{ id: string; attemptKey: string }> {
  validateEmbeddingVector(vector, EMBEDDING_DIMENSION);
  const attemptId = options.attemptId ?? randomUUID();
  const attemptKey = createAttemptKey(target, attemptId);
  const attemptedAt = options.attemptedAt ?? new Date();
  const generatedAt = options.generatedAt ?? new Date();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await client.query('begin');
    try {
      await assertCurrentContract(client, target);
      const result = await client.query<{ id: string }>(`
        insert into app.embeddings (
          search_document_id, entity_id, provider, model, model_revision,
          dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
        ) values ($1, $2, $3, $4, $5, $6, $7::extensions.vector, $8, 'READY', $9, $10, $11)
        returning id
      `, [
        target.documentId, target.entityId, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
        EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION, vectorLiteral(vector),
        target.documentHash, attemptKey, attemptedAt, generatedAt,
      ]);
      await client.query('commit');
      return { id: result.rows[0].id, attemptKey };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}

export async function persistFailedEmbedding(
  connectionString: string,
  target: EmbeddingTarget,
  failure: EmbeddingFailure,
  options: { attemptId?: string; attemptedAt?: Date } = {},
): Promise<{ id: string; attemptKey: string }> {
  const safeFailure = boundedFailure(failure);
  const attemptId = options.attemptId ?? randomUUID();
  const attemptKey = createAttemptKey(target, attemptId);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query<{ id: string }>(`
      insert into app.embeddings (
        search_document_id, entity_id, provider, model, model_revision,
        dimension, document_hash, status, attempt_key, attempted_at, error_class, error_code
      ) values ($1, $2, $3, $4, $5, $6, $7, 'FAILED', $8, $9, $10, $11)
      returning id
    `, [
      target.documentId, target.entityId, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
      EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION, target.documentHash,
      attemptKey, options.attemptedAt ?? new Date(), safeFailure.errorClass, safeFailure.errorCode,
    ]);
    return { id: result.rows[0].id, attemptKey };
  } finally {
    await client.end();
  }
}

export async function staleIncompatibleReadyEmbeddings(connectionString: string): Promise<number> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query(`
      update app.embeddings as embedding
      set status = 'STALE', stale_reason = 'EMBEDDING_CONTRACT_CHANGED'
      where embedding.status = 'READY'
        and not exists (
          select 1
          from app.search_configs as config
          where config.is_active
            and config.embedding_provider = embedding.provider
            and config.embedding_model = embedding.model
            and config.embedding_revision = embedding.model_revision
            and config.embedding_dimension = embedding.dimension
        )
    `);
    return result.rowCount ?? 0;
  } finally {
    await client.end();
  }
}

export async function selectEmbeddingTargets(
  connectionString: string,
  limit: number,
  retryFailed = false,
): Promise<EmbeddingTarget[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > EMBEDDING_CORPUS_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${EMBEDDING_CORPUS_LIMIT}`);
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await assertSelectedConfig(client);
    const result = await client.query<{
      document_id: string;
      entity_id: string;
      entity_type: 'PLACE' | 'EVENT';
      document_hash: string;
      embedding_text: string;
      display_name: string;
    }>(`
      select document.id as document_id, document.entity_id, entity.entity_type,
             document.content_hash as document_hash, document.embedding_text,
             document.display_name
      from app.search_documents as document
      join app.canonical_entities as entity on entity.id = document.entity_id
      join app.geographic_scopes as scope on scope.id = entity.scope_id
      join app.geographic_scope_boundaries as boundary
        on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id
      left join app.places as place on place.entity_id = entity.id
      left join app.events as event on event.entity_id = entity.id
      left join app.places as venue on venue.entity_id = event.venue_place_id
      where document.is_active
        and document.document_version = $1
        and document.template_version = $2
        and btrim(document.embedding_text) <> ''
        and entity.publication_status = 'PUBLISHED'
        and entity.merged_into_id is null
        and scope.is_active
        and scope.public_search_enabled
        and boundary.is_active
        and case entity.entity_type
          when 'PLACE' then place.entity_id is not null
            and place.status <> 'CLOSED'
            and place.location is not null
            and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
          when 'EVENT' then event.entity_id is not null
            and event.status = 'SCHEDULED'
            and coalesce(venue.location, event.location) is not null
            and extensions.st_covers(
              boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry
            )
          else false
        end
        and exists (
          select 1
          from app.source_records as source_record
          join app.source_record_versions as version
            on version.id = source_record.current_version_id
          join app.source_record_parse_attempts as attempt
            on attempt.id = source_record.current_parse_attempt_id
            and attempt.source_record_version_id = version.id
          where source_record.canonical_entity_id = entity.id
            and version.content_status = 'AVAILABLE'
            and attempt.status = 'SUCCEEDED'
        )
        and not exists (
          select 1 from app.embeddings as ready
          where ready.search_document_id = document.id
            and ready.document_hash = document.content_hash
            and ready.provider = $3 and ready.model = $4
            and ready.model_revision = $5 and ready.dimension = $6
            and ready.status = 'READY'
        )
        and ($7::boolean or not exists (
          select 1 from app.embeddings as failed
          where failed.search_document_id = document.id
            and failed.document_hash = document.content_hash
            and failed.provider = $3 and failed.model = $4
            and failed.model_revision = $5 and failed.dimension = $6
            and failed.status = 'FAILED'
        ))
      order by entity.entity_type, entity.id, document.id
      limit $8
    `, [
      EMBEDDING_DOCUMENT_VERSION, EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
      EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION,
      EMBEDDING_DIMENSION, retryFailed, limit,
    ]);
    return result.rows.map((row) => ({
      documentId: row.document_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      documentHash: row.document_hash,
      embeddingText: row.embedding_text,
      displayName: row.display_name,
    }));
  } finally {
    await client.end();
  }
}

export async function generateSelectedModelEmbeddings(
  connectionString: string,
  apiKey: string,
  config: SelectedEmbeddingConfig,
  options: {
    retryFailed?: boolean;
    requestEmbedding?: (text: string) => Promise<number[]>;
    onProgress?: (progress: EmbeddingGenerationProgress) => void;
  } = {},
): Promise<EmbeddingGenerationReport> {
  validateSelectedEmbeddingConfig(config);
  const staleIncompatible = await staleIncompatibleReadyEmbeddings(connectionString);
  const targets = await selectEmbeddingTargets(connectionString, config.corpusLimit, options.retryFailed);
  const report: EmbeddingGenerationReport = {
    selected: targets.length,
    ...(await processEmbeddingTargets(targets, config.batchSize, {
      requestEmbedding: options.requestEmbedding
        ?? ((text: string) => requestVoyageEmbedding(text, EMBEDDING_DOCUMENT_INPUT_TYPE, apiKey)),
      persistReady: async (target, vector, attempt) => {
        await persistReadyEmbedding(connectionString, target, vector, attempt);
      },
      persistFailed: async (target, failure, attempt) => {
        await persistFailedEmbedding(connectionString, target, failure, attempt);
      },
    }, options.onProgress)),
    staleIncompatible,
  };
  return report;
}

export async function processEmbeddingTargets(
  targets: EmbeddingTarget[],
  batchSize: number,
  operations: EmbeddingTargetOperations,
  onProgress?: (progress: EmbeddingGenerationProgress) => void,
): Promise<Pick<EmbeddingGenerationReport, 'attempted' | 'ready' | 'failed'>> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > EMBEDDING_BATCH_SIZE) {
    throw new Error(`batchSize must be between 1 and ${EMBEDDING_BATCH_SIZE}`);
  }
  const report = { attempted: 0, ready: 0, failed: 0 };
  for (let offset = 0; offset < targets.length; offset += batchSize) {
    const batch = targets.slice(offset, offset + batchSize);
    for (const target of batch) {
      const attemptId = randomUUID();
      const attemptedAt = new Date();
      report.attempted += 1;
      let outcome: 'READY' | 'FAILED';
      try {
        const vector = validateEmbeddingVector(
          await operations.requestEmbedding(target.embeddingText),
          EMBEDDING_DIMENSION,
        );
        await operations.persistReady(target, vector, { attemptId, attemptedAt });
        report.ready += 1;
        outcome = 'READY';
      } catch (error) {
        const failure = embeddingFailureFromError(error);
        await operations.persistFailed(target, failure, { attemptId, attemptedAt });
        report.failed += 1;
        outcome = 'FAILED';
      }
      onProgress?.({
        processed: report.attempted,
        total: targets.length,
        documentId: target.documentId,
        entityType: target.entityType,
        outcome,
      });
    }
  }
  return report;
}

export async function getEmbeddingCoverageReport(connectionString: string): Promise<EmbeddingCoverageReport> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await assertSelectedConfig(client);
    const counts = await client.query<{
      active_place_documents: number;
      active_event_documents: number;
      total_active: number;
      eligible: number;
      compatible_ready: number;
      failed_documents: number;
      failed_attempts: number;
      stale_attempts: number;
      missing_unattempted: number;
      incompatible_ready: number;
    }>(`
      with active as (
        select document.id, document.content_hash, entity.entity_type,
               entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
                 and scope.is_active and scope.public_search_enabled and boundary.is_active
                 and case entity.entity_type
                   when 'PLACE' then place.entity_id is not null and place.status <> 'CLOSED'
                     and place.location is not null
                     and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
                   when 'EVENT' then event.entity_id is not null and event.status = 'SCHEDULED'
                     and coalesce(venue.location, event.location) is not null
                     and extensions.st_covers(
                       boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry
                     )
                   else false
                 end
                 and exists (
                   select 1
                   from app.source_records as source_record
                   join app.source_record_versions as version
                     on version.id = source_record.current_version_id
                   join app.source_record_parse_attempts as attempt
                     on attempt.id = source_record.current_parse_attempt_id
                     and attempt.source_record_version_id = version.id
                   where source_record.canonical_entity_id = entity.id
                     and version.content_status = 'AVAILABLE'
                     and attempt.status = 'SUCCEEDED'
                 ) as eligible
        from app.search_documents as document
        join app.canonical_entities as entity on entity.id = document.entity_id
        join app.geographic_scopes as scope on scope.id = entity.scope_id
        join app.geographic_scope_boundaries as boundary
          on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id
        left join app.places as place on place.entity_id = entity.id
        left join app.events as event on event.entity_id = entity.id
        left join app.places as venue on venue.entity_id = event.venue_place_id
        where document.is_active
          and document.document_version = $1
          and document.template_version = $2
      ), state as (
        select active.*,
               exists (
                 select 1 from app.embeddings as embedding
                 where embedding.search_document_id = active.id
                   and embedding.document_hash = active.content_hash
                   and embedding.provider = $3 and embedding.model = $4
                   and embedding.model_revision = $5 and embedding.dimension = $6
                   and embedding.status = 'READY'
               ) as compatible_ready,
               (select count(*)::integer from app.embeddings as embedding
                 where embedding.search_document_id = active.id
                   and embedding.document_hash = active.content_hash
                   and embedding.provider = $3 and embedding.model = $4
                   and embedding.model_revision = $5 and embedding.dimension = $6
                   and embedding.status = 'FAILED') as failed_attempts
        from active
      )
      select
        count(*) filter (where entity_type = 'PLACE')::integer as active_place_documents,
        count(*) filter (where entity_type = 'EVENT')::integer as active_event_documents,
        count(*)::integer as total_active,
        count(*) filter (where eligible)::integer as eligible,
        count(*) filter (where eligible and compatible_ready)::integer as compatible_ready,
        count(*) filter (where eligible and failed_attempts > 0)::integer as failed_documents,
        coalesce(sum(failed_attempts) filter (where eligible), 0)::integer as failed_attempts,
        (select count(*)::integer from app.embeddings where status = 'STALE') as stale_attempts,
        count(*) filter (where eligible and not compatible_ready and failed_attempts = 0)::integer
          as missing_unattempted,
        (select count(*)::integer
         from app.embeddings as embedding
         where embedding.status = 'READY'
           and not exists (
             select 1 from app.compatible_ready_embeddings_v as compatible
             where compatible.id = embedding.id
           )) as incompatible_ready
      from state
    `, [
      EMBEDDING_DOCUMENT_VERSION, EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
      EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION,
    ]);
    const row = counts.rows[0];
    const failures = await client.query<{
      id: string;
      attempt_key: string;
      error_class: string;
      error_code: string;
      search_document_id: string;
      document_hash: string;
      ready_on_later_attempt: boolean;
    }>(`
      select failed.id, failed.attempt_key, failed.error_class, failed.error_code,
             failed.search_document_id, failed.document_hash,
             exists (
               select 1 from app.embeddings as ready
               where ready.search_document_id = failed.search_document_id
                 and ready.document_hash = failed.document_hash
                 and ready.provider = failed.provider and ready.model = failed.model
                 and ready.model_revision = failed.model_revision
                 and ready.dimension = failed.dimension and ready.status = 'READY'
             ) as ready_on_later_attempt
      from app.embeddings as failed
      join app.search_documents as document on document.id = failed.search_document_id
      where failed.status = 'FAILED'
        and failed.provider = $1 and failed.model = $2
        and failed.model_revision = $3 and failed.dimension = $4
      order by failed.attempted_at, failed.id
      limit 100
    `, [EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION]);
    return {
      selectedContract: {
        provider: EMBEDDING_PROVIDER,
        model: EMBEDDING_MODEL,
        revision: EMBEDDING_MODEL_REVISION,
        dimension: EMBEDDING_DIMENSION,
        configVersion: EMBEDDING_CONFIG_VERSION,
        documentInputType: EMBEDDING_DOCUMENT_INPUT_TYPE,
        queryInputType: EMBEDDING_QUERY_INPUT_TYPE,
        documentVersion: EMBEDDING_DOCUMENT_VERSION,
        documentTemplateVersion: EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
      },
      corpus: {
        activePlaceDocuments: row.active_place_documents,
        activeEventDocuments: row.active_event_documents,
        totalActive: row.total_active,
        eligible: row.eligible,
      },
      embeddingState: {
        compatibleReady: row.compatible_ready,
        failedDocuments: row.failed_documents,
        failedAttempts: row.failed_attempts,
        staleAttempts: row.stale_attempts,
        missingUnattempted: row.missing_unattempted,
        incompatibleReady: row.incompatible_ready,
      },
      coveragePercentage: row.eligible === 0
        ? 100
        : Number(((row.compatible_ready / row.eligible) * 100).toFixed(2)),
      failures: failures.rows.map((failure) => ({
        id: failure.id,
        attemptKey: failure.attempt_key,
        errorClass: failure.error_class,
        errorCode: failure.error_code,
        documentId: failure.search_document_id,
        documentHash: failure.document_hash,
        retryStatus: failure.ready_on_later_attempt ? 'READY_ON_LATER_ATTEMPT' : 'RETRY_AVAILABLE',
      })),
    };
  } finally {
    await client.end();
  }
}

async function assertCurrentContract(client: pg.Client, target: EmbeddingTarget): Promise<void> {
  const document = await client.query(`
    select 1 from app.search_documents
    where id = $1 and entity_id = $2 and content_hash = $3 and is_active
    for share
  `, [target.documentId, target.entityId, target.documentHash]);
  if (document.rowCount !== 1) throw new Error('SearchDocument is no longer active or hash-compatible');
  const config = await client.query(`
    select 1 from app.search_configs
    where is_active and embedding_provider = $1 and embedding_model = $2
      and embedding_revision = $3 and embedding_dimension = $4
  `, [
    EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION,
  ]);
  if (config.rowCount !== 1) throw new Error('active embedding configuration is incompatible');
}

async function assertSelectedConfig(client: pg.Client): Promise<void> {
  const result = await client.query(`
    select 1 from app.search_configs
    where is_active and embedding_provider = $1 and embedding_model = $2
      and embedding_revision = $3 and embedding_dimension = $4
  `, [
    EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION,
  ]);
  if (result.rowCount !== 1) {
    throw new Error('EMBED_PROVIDER_CONTRACT_BLOCKED: active selected embedding configuration is incompatible');
  }
}

function embeddingFailureFromError(error: unknown): EmbeddingFailure {
  if (error instanceof EmbeddingRequestError) {
    return boundedFailure({ errorClass: error.errorClass, errorCode: error.errorCode });
  }
  if (error instanceof Error && /SearchDocument is no longer active or hash-compatible/.test(error.message)) {
    return { errorClass: 'DOCUMENT', errorCode: 'DOCUMENT_CHANGED_IN_FLIGHT' };
  }
  return { errorClass: 'GENERATOR', errorCode: 'UNEXPECTED_ERROR' };
}

function boundedFailure(failure: EmbeddingFailure): EmbeddingFailure {
  const errorClass = failure.errorClass.trim().slice(0, MAX_ERROR_IDENTITY_LENGTH);
  const errorCode = failure.errorCode.trim().slice(0, MAX_ERROR_IDENTITY_LENGTH);
  if (!errorClass || !errorCode) throw new Error('embedding failure identity is required');
  return { errorClass, errorCode };
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
