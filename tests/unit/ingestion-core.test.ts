import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ensureFixtureSource,
  fixtureDatabaseUrl,
  FixtureSourceAdapter,
  IngestionRunError,
  PostgresIngestionStore,
  runIngestion,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import type { FixtureAdapterOptions, FixturePlace } from '../../packages/ingestion-domain/src/fixture-adapter.ts';
import type { SourceEvidenceExecution } from '../../packages/ingestion-domain/src/types.ts';

const namespace = randomUUID().slice(0, 8);
const sourceKey = `fixture-ing-01-test-${namespace}`;
const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);

function fixture(options: FixtureAdapterOptions = {}): FixtureSourceAdapter {
  return new FixtureSourceAdapter({ sourceKey, ...options });
}

function place(externalKey: string, overrides: Partial<FixturePlace> = {}): FixturePlace {
  return {
    externalKey: `${namespace}-${externalKey}`,
    name: `Fixture ${externalKey}`,
    latitude: 57.7826,
    longitude: 14.1618,
    taxonomySlug: 'coffee-shop',
    ...overrides,
  };
}

beforeAll(async () => {
  await ensureFixtureSource(connectionString, fixture().config);
});

afterAll(async () => {
  await store.close();
});

describe('ING-01 six-stage ingestion core', () => {
  it('executes all six diagnosable stages for a new fixture Place', async () => {
    const result = await runIngestion(store, fixture({ records: [place('six-stage')] }));
    expect(result.status).toBe('SUCCEEDED');
    expect(result.counters).toMatchObject({ fetched: 1, newCount: 1, valid: 1, canonicalApplied: 1 });
    expect(result.stageTrace.map(({ stage }) => stage)).toEqual([
      'fetch',
      'capture/version',
      'parse/validate',
      'resolve',
      'canonical/taxonomy',
      'projection/publication',
    ]);
    expect(result.projectionOutcomes).toEqual([{
      searchDocument: 'PENDING', embedding: 'PENDING', publication: 'PENDING',
    }]);
  });

  it('classifies NEW, UNCHANGED, and CHANGED without duplicate record, version, or canonical identity', async () => {
    const externalKey = `${namespace}-classification`;
    const first = await runIngestion(store, fixture({ records: [place('classification')] }));
    const unchanged = await runIngestion(store, fixture({ records: [place('classification')] }));
    const changed = await runIngestion(store, fixture({ records: [place('classification', { name: 'Changed Fixture Name' })] }));

    expect(first.counters).toMatchObject({ newCount: 1, changed: 0, unchanged: 0 });
    expect(unchanged.counters).toMatchObject({ newCount: 0, changed: 0, unchanged: 1, canonicalApplied: 0 });
    expect(changed.counters).toMatchObject({ newCount: 0, changed: 1, unchanged: 0, canonicalApplied: 1 });
    const [counts] = await fixtureQuery<{
      records: number; versions: number; attempts: number; entities: number;
    }>(connectionString, `
      select count(distinct record.id)::int as records,
             count(distinct version.id)::int as versions,
             count(distinct attempt.id)::int as attempts,
             count(distinct record.canonical_entity_id)::int as entities
      from app.source_records record
      join app.sources source on source.id = record.source_id
      join app.source_record_versions version on version.source_record_id = record.id
      left join app.source_record_parse_attempts attempt on attempt.source_record_version_id = version.id
      where source.key = $1 and record.external_key = $2
    `, [sourceKey, externalKey]);
    expect(counts).toEqual({ records: 1, versions: 2, attempts: 2, entities: 1 });
  });

  it('captures H before a FAILED parse and preserves the last-good pair and canonical truth', async () => {
    const goodRecord = place('last-good', { name: 'Last Good Name' });
    await runIngestion(store, fixture({ records: [goodRecord] }));
    const [before] = await currentState(goodRecord.externalKey);

    const failed = await runIngestion(store, fixture({
      records: [{ ...goodRecord, name: 'Rejected New Name', parserReject: true }],
    }));
    const [after] = await currentState(goodRecord.externalKey);
    expect(failed.status).toBe('PARTIAL');
    expect(failed.counters).toMatchObject({ changed: 1, invalid: 1, canonicalApplied: 0 });
    expect(after.current_version_id).toBe(before.current_version_id);
    expect(after.current_parse_attempt_id).toBe(before.current_parse_attempt_id);
    expect(after.canonical_name).toBe('Last Good Name');
    expect(after.version_count).toBe(2);
    expect(after.failed_count).toBe(1);
  });

  it('replays a corrected parser over the same failed H without creating a fake version', async () => {
    const raw = place('failed-replay', { name: 'Correctable Fixture', parserReject: true });
    const failed = await runIngestion(store, fixture({ records: [raw], parserVersion: 'fixture-parser-v1' }));
    const succeeded = await runIngestion(store, fixture({
      records: [raw], parserVersion: 'fixture-parser-v2', acceptRejectedPayload: true,
    }));
    const [state] = await currentState(raw.externalKey);

    expect(failed.status).toBe('PARTIAL');
    expect(succeeded.status).toBe('SUCCEEDED');
    expect(succeeded.counters.unchanged).toBe(1);
    expect(state.version_count).toBe(1);
    expect(state.failed_count).toBe(1);
    expect(state.succeeded_count).toBe(1);
    expect(state.current_version_id).not.toBeNull();
  });

  it('selects A2 over A1 for a successful same-H parser replay', async () => {
    const raw = place('successful-replay');
    await runIngestion(store, fixture({ records: [raw], parserVersion: 'fixture-parser-v1' }));
    const [first] = await currentState(raw.externalKey);
    await runIngestion(store, fixture({ records: [raw], parserVersion: 'fixture-parser-v2' }));
    const [second] = await currentState(raw.externalKey);

    expect(second.current_version_id).toBe(first.current_version_id);
    expect(second.current_parse_attempt_id).not.toBe(first.current_parse_attempt_id);
    expect(second.version_count).toBe(1);
    expect(second.succeeded_count).toBe(2);
  });

  it('creates a new retry run and attempt while leaving the terminal prior run immutable', async () => {
    const raw = place('terminal-retry', { parserReject: true });
    const failed = await runIngestion(store, fixture({ records: [raw], parserVersion: 'retry-parser-v1' }));
    const retry = await runIngestion(store, fixture({
      records: [raw], parserVersion: 'retry-parser-v2', acceptRejectedPayload: true,
    }), { retryOfRunId: failed.runId });
    const runs = await fixtureQuery<{ id: string; status: string; retry_of_run_id: string | null }>(connectionString, `
      select id, status, retry_of_run_id from app.ingestion_runs where id = any($1::uuid[]) order by started_at
    `, [[failed.runId, retry.runId]]);

    expect(failed.status).toBe('PARTIAL');
    expect(retry.status).toBe('SUCCEEDED');
    expect(runs[1].retry_of_run_id).toBe(failed.runId);
    await expect(fixtureQuery(connectionString, `
      update app.ingestion_runs set parser_version = 'rewritten' where id = $1
    `, [failed.runId])).rejects.toMatchObject({ code: '55000' });
    const [state] = await currentState(raw.externalKey);
    expect(state.attempt_count).toBe(2);
  });

  it('resumes the same STARTED attempt within one live run', async () => {
    const adapter = fixture({ records: [place('live-resume')], parserVersion: 'live-resume-parser' });
    const fetched = await adapter.fetch({ signal: new AbortController().signal });
    const observation = fetched.observations[0];
    const runId = await store.startRun({
      idempotencyKey: `${sourceKey}:live-resume:${randomUUID()}`,
      config: adapter.config,
      retryOfRunId: null,
      snapshotKey: null,
    });
    const capture = await store.capture(
      runId,
      adapter.config,
      observation,
      adapter.captureEnvelope(observation),
    );
    const firstAttempt = await store.beginParseAttempt(runId, capture.sourceRecordVersionId, adapter.config.parserVersion);
    const resumedAttempt = await store.beginParseAttempt(runId, capture.sourceRecordVersionId, adapter.config.parserVersion);
    expect(resumedAttempt).toBe(firstAttempt);
    await store.failParseAttempt(firstAttempt, 'FixtureInterruption', 'INTERRUPTED');
    await store.finishRun({
      runId,
      status: 'PARTIAL',
      refreshMode: 'DELTA_ONLY',
      refreshUnitComplete: false,
      snapshotComplete: null,
      counters: {
        fetched: 1, valid: 0, invalid: 1, newCount: 1, changed: 0,
        unchanged: 0, unresolved: 0, disappeared: 0, canonicalApplied: 0, published: 0,
      },
      observedExternalKeys: [observation.externalKey],
    });
  });

  it('keeps unresolved evidence current without inventing a heuristic identity link', async () => {
    const raw = place('unresolved', { resolution: 'UNRESOLVED' });
    const result = await runIngestion(store, fixture({ records: [raw] }));
    const [state] = await currentState(raw.externalKey);
    expect(result.status).toBe('PARTIAL');
    expect(result.counters.unresolved).toBe(1);
    expect(state.current_version_id).not.toBeNull();
    expect(state.current_parse_attempt_id).not.toBeNull();
    expect(state.canonical_entity_id).toBeNull();
  });

  it('does not merge two new records merely because their names match', async () => {
    const records = [
      place('same-name-a', { name: 'Legitimate Same Fixture Name' }),
      place('same-name-b', { name: 'Legitimate Same Fixture Name' }),
    ];
    const result = await runIngestion(store, fixture({ records }));
    const rows = await fixtureQuery<{ canonical_entity_id: string }>(connectionString, `
      select record.canonical_entity_id
      from app.source_records record join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = any($2::text[])
    `, [sourceKey, records.map(({ externalKey }) => externalKey)]);
    expect(result.counters.canonicalApplied).toBe(2);
    expect(new Set(rows.map(({ canonical_entity_id }) => canonical_entity_id)).size).toBe(2);
  });

  it('rolls back canonical/taxonomy changes when the later-stage seam fails', async () => {
    const raw = place('later-failure', { name: 'Prior Canonical Truth' });
    await runIngestion(store, fixture({ records: [raw] }));
    const [before] = await currentState(raw.externalKey);
    await expect(runIngestion(store, fixture({
      records: [{ ...raw, name: 'Must Roll Back' }],
    }), {
      projectionOrchestrator: async () => { throw new Error('injected projection failure'); },
    })).rejects.toBeInstanceOf(IngestionRunError);
    const [after] = await currentState(raw.externalKey);
    expect(after.current_parse_attempt_id).not.toBe(before.current_parse_attempt_id);
    expect(after.canonical_name).toBe('Prior Canonical Truth');
    expect(after.active_memberships).toBe(before.active_memberships);
    expect(after.search_documents).toBe(0);

    const recovered = await runIngestion(store, fixture({
      records: [{ ...raw, name: 'Must Roll Back' }],
    }));
    const [recoveredState] = await currentState(raw.externalKey);
    expect(recovered.counters).toMatchObject({ unchanged: 1, canonicalApplied: 1 });
    expect(recoveredState.current_parse_attempt_id).toBe(after.current_parse_attempt_id);
    expect(recoveredState.attempt_count).toBe(after.attempt_count);
    expect(recoveredState.canonical_name).toBe('Must Roll Back');
  });

  it('rejects stale H+A1 canonical processing after same-H A2 becomes current', async () => {
    const raw = place('stale-processing');
    await runIngestion(store, fixture({ records: [raw], parserVersion: 'stale-parser-v1' }));
    const [first] = await currentState(raw.externalKey);
    await runIngestion(store, fixture({ records: [raw], parserVersion: 'stale-parser-v2' }));
    const oldEvidence: SourceEvidenceExecution = {
      sourceRecordId: first.source_record_id,
      sourceRecordVersionId: first.current_version_id,
      sourceRecordParseAttemptId: first.current_parse_attempt_id,
    };
    const adapter = fixture({ records: [raw] });
    const fetched = await adapter.fetch({ signal: new AbortController().signal });
    const candidate = adapter.parse(fetched.observations[0].envelope, fetched.observations[0]);
    await expect(store.applyCanonical({
      evidence: oldEvidence,
      candidate,
      mappingVersion: adapter.config.mappingVersion,
      beforeCommit: async () => ({ searchDocument: 'PENDING', embedding: 'PENDING', publication: 'PENDING' }),
    })).rejects.toMatchObject({ code: '40001' });
  });

  it('treats DELTA_ONLY absence as harmless', async () => {
    const raw = place('delta-absence');
    await runIngestion(store, fixture({ records: [raw] }));
    const empty = await runIngestion(store, fixture({ records: [] }));
    const [state] = await currentState(raw.externalKey);
    expect(empty.status).toBe('SUCCEEDED');
    expect(empty.counters.disappeared).toBe(0);
    expect(state.is_missing).toBe(false);
    expect(state.miss_count).toBe(0);
  });

  it('allows disappearance only after a successful complete snapshot', async () => {
    const snapshotSource = `${sourceKey}-snapshot`;
    const snapshotFixture = (options: FixtureAdapterOptions = {}) => new FixtureSourceAdapter({
      sourceKey: snapshotSource,
      refreshMode: 'COMPLETE_SNAPSHOT',
      ...options,
    });
    const snapshotStore = new PostgresIngestionStore(connectionString);
    await ensureFixtureSource(connectionString, snapshotFixture().config);
    const raw = place('snapshot-absence');
    await runIngestion(snapshotStore, snapshotFixture({ records: [raw] }));
    const partial = await runIngestion(snapshotStore, snapshotFixture({
      records: [], refreshUnitComplete: false, snapshotComplete: false,
    }));
    let [state] = await currentState(raw.externalKey, snapshotSource);
    expect(partial.status).toBe('PARTIAL');
    expect(state.is_missing).toBe(false);

    const complete = await runIngestion(snapshotStore, snapshotFixture({ records: [], snapshotComplete: true }));
    [state] = await currentState(raw.externalKey, snapshotSource);
    expect(complete.status).toBe('SUCCEEDED');
    expect(complete.counters.disappeared).toBe(1);
    expect(state.is_missing).toBe(true);
    expect(state.miss_count).toBe(1);
    await snapshotStore.close();
  });

  it('reuses a historically observed H when content returns', async () => {
    const original = place('historical-h', { name: 'Original H' });
    await runIngestion(store, fixture({ records: [original], parserVersion: 'history-parser-v1' }));
    const [first] = await currentState(original.externalKey);
    await runIngestion(store, fixture({
      records: [{ ...original, name: 'Different H' }], parserVersion: 'history-parser-v2',
    }));
    await runIngestion(store, fixture({ records: [original], parserVersion: 'history-parser-v3' }));
    const [returned] = await currentState(original.externalKey);
    expect(returned.version_count).toBe(2);
    expect(returned.current_version_id).toBe(first.current_version_id);
    expect(returned.current_parse_attempt_id).not.toBe(first.current_parse_attempt_id);
  });

  it('uses uniqueness and CAS to avoid duplicate evidence/canonical rows under competing runs', async () => {
    const raw = place('concurrent');
    const results = await Promise.allSettled([
      runIngestion(store, fixture({ records: [raw] })),
      runIngestion(store, fixture({ records: [raw] })),
    ]);
    const [state] = await currentState(raw.externalKey);
    expect(results.some(({ status }) => status === 'fulfilled')).toBe(true);
    expect(state.version_count).toBe(1);
    expect(state.canonical_entity_id).not.toBeNull();
    const [entityCount] = await fixtureQuery<{ count: number }>(connectionString, `
      select count(*)::int as count from app.canonical_entities where id = $1
    `, [state.canonical_entity_id]);
    expect(entityCount.count).toBe(1);
  });
});

type CurrentState = {
  source_record_id: string;
  canonical_entity_id: string | null;
  current_version_id: string;
  current_parse_attempt_id: string;
  canonical_name: string | null;
  is_missing: boolean;
  miss_count: number;
  version_count: number;
  attempt_count: number;
  failed_count: number;
  succeeded_count: number;
  active_memberships: number;
  search_documents: number;
};

function currentState(externalKey: string, selectedSourceKey = sourceKey): Promise<CurrentState[]> {
  return fixtureQuery<CurrentState>(connectionString, `
    select record.id as source_record_id, record.canonical_entity_id,
           record.current_version_id, record.current_parse_attempt_id,
           canonical.canonical_name, record.is_missing, record.miss_count,
           count(distinct version.id)::int as version_count,
           count(distinct attempt.id)::int as attempt_count,
           count(distinct attempt.id) filter (where attempt.status = 'FAILED')::int as failed_count,
           count(distinct attempt.id) filter (where attempt.status = 'SUCCEEDED')::int as succeeded_count,
           count(distinct membership.id) filter (where membership.active)::int as active_memberships,
           count(distinct document.id)::int as search_documents
    from app.source_records record
    join app.sources source on source.id = record.source_id
    left join app.source_record_versions version on version.source_record_id = record.id
    left join app.source_record_parse_attempts attempt on attempt.source_record_version_id = version.id
    left join app.canonical_entities canonical on canonical.id = record.canonical_entity_id
    left join app.entity_taxonomy_memberships membership on membership.entity_id = canonical.id
    left join app.search_documents document on document.entity_id = canonical.id
    where source.key = $1 and record.external_key = $2
    group by record.id, canonical.canonical_name
  `, [selectedSourceKey, externalKey]);
}
