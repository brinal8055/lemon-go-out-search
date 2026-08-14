import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  createDuplicateCandidate,
  decideSameTypeA,
  decideSeparate,
  decideUnsure,
  ensureFixtureSource,
  fixtureDatabaseUrl,
  FixtureSourceAdapter,
  PostgresIngestionStore,
  prepareLocalDuplicateReviewRuntime,
  reverseDuplicateSame,
  runIngestion,
  showDuplicateCandidate,
} from './index.ts';
import { fixtureQuery } from './testing.ts';

type RecordRow = {
  id: string;
  external_key: string;
  canonical_entity_id: string | null;
  resolution_method: string;
};

export async function runDuplicateReviewSmoke(): Promise<{
  typeAHistory: number;
  reversalOpen: boolean;
  concurrentSuccesses: number;
  concurrentConflicts: number;
}> {
  const connectionString = fixtureDatabaseUrl();
  const namespace = randomUUID().slice(0, 8);
  const sourceKey = `fixture-dedup-smoke-${namespace}`;
  const adapter = new FixtureSourceAdapter({
    sourceKey,
    records: [
      { externalKey: `${namespace}-type-a-unresolved`, name: 'Smoke Type A', resolution: 'UNRESOLVED' },
      { externalKey: `${namespace}-type-a-target`, name: 'Smoke Type A' },
      { externalKey: `${namespace}-race-a`, name: 'Smoke Race A' },
      { externalKey: `${namespace}-race-b`, name: 'Smoke Race B' },
    ],
  });
  const store = new PostgresIngestionStore(connectionString);
  try {
    await ensureFixtureSource(connectionString, adapter.config);
    await prepareLocalDuplicateReviewRuntime(connectionString);
    const ingestion = await runIngestion(store, adapter);
    if (ingestion.counters.valid !== 4 || ingestion.counters.unresolved !== 1) {
      throw new Error('duplicate smoke fixture ingestion did not produce the expected evidence');
    }

    const records = await fixtureQuery<RecordRow>(connectionString, `
      select record.id, record.external_key, record.canonical_entity_id, record.resolution_method
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      where source.key = $1
    `, [sourceKey]);
    const byKey = new Map(records.map((record) => [record.external_key, record]));
    const unresolved = requiredRecord(byKey, `${namespace}-type-a-unresolved`);
    const target = requiredRecord(byKey, `${namespace}-type-a-target`);
    if (!target.canonical_entity_id) throw new Error('Type A smoke target has no canonical entity');

    const typeACandidateId = await createDuplicateCandidate(
      connectionString, unresolved.id, target.id, 'dedup-smoke',
    );
    const typeAOpen = await showDuplicateCandidate(connectionString, typeACandidateId);
    const typeASameId = await decideSameTypeA(
      connectionString,
      typeACandidateId,
      typeAOpen.current_decision_id,
      unresolved.id,
      target.canonical_entity_id,
      'dedup-smoke',
    );
    await reverseDuplicateSame(connectionString, typeACandidateId, typeASameId, 'dedup-smoke');
    const typeAReversed = await showDuplicateCandidate(connectionString, typeACandidateId);
    const [restored] = await fixtureQuery<RecordRow>(connectionString, `
      select id, external_key, canonical_entity_id, resolution_method
      from app.source_records where id = $1
    `, [unresolved.id]);
    if (restored.canonical_entity_id !== null || restored.resolution_method !== 'UNRESOLVED') {
      throw new Error('Type A reversal did not restore the unresolved record');
    }

    const raceA = requiredRecord(byKey, `${namespace}-race-a`);
    const raceB = requiredRecord(byKey, `${namespace}-race-b`);
    const raceCandidateId = await createDuplicateCandidate(connectionString, raceA.id, raceB.id, 'dedup-smoke');
    const raceOpen = await showDuplicateCandidate(connectionString, raceCandidateId);
    const race = await Promise.allSettled([
      decideSeparate(connectionString, raceCandidateId, raceOpen.current_decision_id, 'reviewer-one'),
      decideUnsure(connectionString, raceCandidateId, raceOpen.current_decision_id, 'reviewer-two'),
    ]);
    const successes = race.filter((result) => result.status === 'fulfilled').length;
    const conflicts = race.filter((result) => result.status === 'rejected'
      && isSerializationConflict(result.reason)).length;
    if (successes !== 1 || conflicts !== 1) {
      throw new Error(`concurrent review expected one success and one conflict; got ${successes}/${conflicts}`);
    }
    const raceFinal = await showDuplicateCandidate(connectionString, raceCandidateId);
    if (raceFinal.decisions.length !== 2 || raceFinal.status === 'OPEN') {
      throw new Error('concurrent review did not retain one linear final decision');
    }

    return {
      typeAHistory: typeAReversed.decisions.length,
      reversalOpen: typeAReversed.status === 'OPEN',
      concurrentSuccesses: successes,
      concurrentConflicts: conflicts,
    };
  } finally {
    await store.close();
  }
}

function requiredRecord(records: Map<string, RecordRow>, key: string): RecordRow {
  const record = records.get(key);
  if (!record) throw new Error(`missing smoke record ${key}`);
  return record;
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '40001';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await runDuplicateReviewSmoke()));
}
