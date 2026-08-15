import pg from 'pg';

import {
  fixtureDatabaseUrl,
  prepareLocalIngestionRuntime,
} from '@lemon/ingestion-domain';
import {
  prepareLocalSearchDocumentRuntime,
  publishPlaceWithSearchDocument,
} from '@lemon/search-documents';

const { Client } = pg;

type PublicationCandidate = {
  entityId: string;
  sourceRecordId: string;
  sourceRecordVersionId: string;
  sourceRecordParseAttemptId: string;
  normalizedOutput: unknown;
};

export type EligiblePlacePublicationReport = {
  candidates: number;
  published: number;
  documentsCreated: number;
  documentsReactivated: number;
  documentsUnchanged: number;
  embeddingsStaled: number;
  entityIds: string[];
};

export async function publishEligiblePlaces(
  connectionString = fixtureDatabaseUrl(),
  options: { captureRunIds?: string[] } = {},
): Promise<EligiblePlacePublicationReport> {
  await prepareLocalIngestionRuntime(connectionString);
  await prepareLocalSearchDocumentRuntime(connectionString);
  const candidates = await publicationCandidates(connectionString, options.captureRunIds);
  const report: EligiblePlacePublicationReport = {
    candidates: candidates.length,
    published: 0,
    documentsCreated: 0,
    documentsReactivated: 0,
    documentsUnchanged: 0,
    embeddingsStaled: 0,
    entityIds: [],
  };
  for (const candidate of candidates) {
    await selectPublicationFacts(connectionString, candidate);
    const projection = await publishPlaceWithSearchDocument(connectionString, candidate);
    report.published += 1;
    report.entityIds.push(candidate.entityId);
    report.embeddingsStaled += projection.embeddingsStaled;
    if (projection.documentOutcome === 'created') report.documentsCreated += 1;
    else if (projection.documentOutcome === 'reactivated') report.documentsReactivated += 1;
    else report.documentsUnchanged += 1;
  }
  report.entityIds.sort();
  return report;
}

async function publicationCandidates(
  connectionString: string,
  captureRunIds: string[] | undefined,
): Promise<PublicationCandidate[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<PublicationCandidate>(`
      select distinct on (entity.id)
             entity.id as "entityId",
             record.id as "sourceRecordId",
             record.current_version_id as "sourceRecordVersionId",
             record.current_parse_attempt_id as "sourceRecordParseAttemptId",
             attempt.normalized_output as "normalizedOutput"
        from app.canonical_entities as entity
        join app.places as place on place.entity_id = entity.id
        join app.geographic_scope_boundaries as boundary
          on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id and boundary.is_active
        join app.source_records as record on record.canonical_entity_id = entity.id
        join app.sources as source on source.id = record.source_id and source.enabled
        join app.source_record_versions as version on version.id = record.current_version_id
        join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
        join app.entity_taxonomy_memberships as membership
          on membership.entity_id = entity.id and membership.active
         and membership.source_record_version_id = record.current_version_id
        join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
       where entity.entity_type = 'PLACE'
         and entity.publication_status in ('DRAFT', 'PUBLISHED')
         and entity.merged_into_id is null
         and place.status in ('ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN')
         and place.location is not null
         and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
         and version.content_status = 'AVAILABLE'
         and attempt.status = 'SUCCEEDED'
         and attempt.source_record_version_id = record.current_version_id
         and attempt.normalized_output is not null
         and attempt.output_redacted_at is null
         and ($1::uuid[] is null or version.capture_run_id = any($1::uuid[]))
         and not exists (
           select 1 from app.duplicate_candidates as candidate
            where (candidate.record_a_id = record.id or candidate.record_b_id = record.id)
              and candidate.status in ('OPEN', 'UNSURE')
         )
       order by entity.id, source.key, record.id
    `, [captureRunIds ?? null]);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function selectPublicationFacts(
  connectionString: string,
  candidate: PublicationCandidate,
): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await client.query('begin');
    try {
      await client.query(
        'select app.assert_source_record_current_evidence($1, $2, $3)',
        [candidate.sourceRecordId, candidate.sourceRecordVersionId, candidate.sourceRecordParseAttemptId],
      );
      for (const [factKey, factValue] of placeFactValues(candidate.normalizedOutput)) {
        await client.query(`
          select app.replace_targeted_canonical_fact(
            $1, $2::app.fact_key, $3::jsonb, $4,
            'SOURCE_PRECEDENCE', 'COVERAGE-01',
            'Current approved source evidence selected for Place publication.'
          )
        `, [
          candidate.entityId,
          factKey,
          JSON.stringify(factValue),
          candidate.sourceRecordVersionId,
        ]);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}

function placeFactValues(normalizedOutput: unknown): Array<[string, unknown]> {
  if (normalizedOutput === null || typeof normalizedOutput !== 'object' || Array.isArray(normalizedOutput)) {
    throw new Error('Place publication requires normalized object evidence');
  }
  const output = normalizedOutput as Record<string, unknown>;
  const place = output.place;
  const names = output.names;
  if (place === null || typeof place !== 'object' || Array.isArray(place) || !Array.isArray(names)) {
    throw new Error('Place publication normalized evidence is incomplete');
  }
  const placeValue = place as Record<string, unknown>;
  const firstName = names[0];
  const name = firstName !== null && typeof firstName === 'object' && !Array.isArray(firstName)
    ? (firstName as Record<string, unknown>).value
    : placeValue.canonicalName;
  const values: Array<[string, unknown]> = [];
  if (typeof name === 'string' && name.trim()) values.push(['canonical_name', name]);
  if (typeof placeValue.latitude === 'number' && typeof placeValue.longitude === 'number') {
    values.push(['location', { latitude: placeValue.latitude, longitude: placeValue.longitude }]);
  }
  const address = Object.fromEntries([
    ['streetAddress', placeValue.streetAddress],
    ['postalCode', placeValue.postalCode],
    ['locality', placeValue.locality],
    ['countryCode', placeValue.countryCode],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''));
  if (Object.keys(address).length > 0) values.push(['address', address]);
  if (placeValue.openingHours !== undefined && placeValue.openingHours !== null) {
    values.push(['opening_hours', placeValue.openingHours]);
  }
  if (!values.some(([factKey]) => factKey === 'canonical_name')
    || !values.some(([factKey]) => factKey === 'location')) {
    throw new Error('Place publication requires canonical-name and location evidence');
  }
  return values;
}
