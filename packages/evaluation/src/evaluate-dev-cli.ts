import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SearchRequestV1, SearchResponseV1 } from '@lemon/contracts';

import {
  evaluateDev,
  parseEvaluationArgs,
  renderMarkdown,
  stableJson,
  verifyChecksum,
} from './dev-runner.ts';
import type {
  EvalCorpusRecordV1,
  EvalDatasetManifestV1,
  EvalJudgmentSetV1,
} from './index.ts';
import {
  diagnoseDevQuery,
  prepareLocalDiagnosticRuntime,
} from './search-diagnostics.ts';

const root = new URL('../../../', import.meta.url);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);

try {
  const input = parseEvaluationArgs(process.argv.slice(2));
  const [corpusText, corpusChecksum, judgmentText, judgmentChecksum, manifestText, manifestChecksum] = await Promise.all([
    readFile(corpusUrl, 'utf8'),
    readFile(corpusChecksumUrl, 'utf8'),
    readFile(resolve(input.judgmentsPath), 'utf8'),
    readFile(resolve(input.judgmentChecksumPath), 'utf8'),
    readFile(resolve(input.manifestPath), 'utf8'),
    readFile(resolve(input.manifestChecksumPath), 'utf8'),
  ]);
  verifyChecksum(corpusText, corpusChecksum, 'CORPUS');
  verifyChecksum(judgmentText, judgmentChecksum, 'JUDGMENT');
  verifyChecksum(manifestText, manifestChecksum, 'DATASET_MANIFEST');
  const judgments = JSON.parse(judgmentText) as EvalJudgmentSetV1;
  const manifest = JSON.parse(manifestText) as EvalDatasetManifestV1;
  if (judgments.judgment_version !== input.judgmentVersion) throw new Error('JUDGMENT_VERSION_MISMATCH');
  if (manifest.manifest_version !== input.manifestVersion) throw new Error('DATASET_MANIFEST_VERSION_MISMATCH');
  if (judgments.status !== 'FROZEN' || judgments.records.length === 0) throw new Error('EVAL_JUDGMENTS_BLOCKED');
  if (manifest.status !== 'FROZEN') throw new Error('DATASET_MANIFEST_NOT_FROZEN');

  const corpus = corpusText.split(/\r?\n/)
    .filter((line) => line.includes('"split":"DEV"'))
    .map((line) => JSON.parse(line) as EvalCorpusRecordV1);
  const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const cleanupDiagnosticRuntime = await prepareLocalDiagnosticRuntime(connectionString);
  const report = await evaluateDev(
    corpus,
    judgments,
    manifest,
    {
      corpusChecksum: corpusChecksum.trim(),
      judgmentChecksum: judgmentChecksum.trim(),
      manifestChecksum: manifestChecksum.trim(),
    },
    createPublicSearch(input.edgeUrl),
    (record, entityId) => diagnoseDevQuery(connectionString, record, entityId),
  ).finally(cleanupDiagnosticRuntime);
  await mkdir(resolve(input.outputDirectory), { recursive: true });
  await Promise.all([
    writeFile(resolve(input.outputDirectory, 'dev-report.v1.json'), `${stableJson(report)}\n`),
    writeFile(resolve(input.outputDirectory, 'dev-report.v1.md'), renderMarkdown(report)),
  ]);
  console.log(`DEV evaluation PASS: ${report.overall.judgedQueryCount} queries, checksum ${report.contentChecksum}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'EVALUATION_FAILED');
  process.exitCode = 1;
}

function createPublicSearch(edgeUrl: string) {
  const endpoint = edgeUrl.trim();
  if (!endpoint) throw new Error('EDGE_URL_REQUIRED');
  return async (record: EvalCorpusRecordV1) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toSearchRequest(record)),
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !isSearchResponse(value)) throw new Error('PUBLIC_SEARCH_FAILED');
    return value.results.map(({ canonicalId }) => ({ canonicalId }));
  };
}

function toSearchRequest(record: EvalCorpusRecordV1): SearchRequestV1 {
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = record.request_filters.location as {
    latitude?: unknown;
    longitude?: unknown;
    radius_meters?: unknown;
  } | undefined;
  const entityTypes = record.request_filters.entity_types;
  return {
    query: record.query,
    uiLocale: record.ui_locale,
    scopeId: record.scope.scope_id,
    limit: 20,
    ...(typeof taxonomy?.node_id === 'string' ? { taxonomyNodeId: taxonomy.node_id } : {}),
    ...(Array.isArray(entityTypes) ? { entityTypes: entityTypes as SearchRequestV1['entityTypes'] } : {}),
    ...(typeof location?.latitude === 'number'
      && typeof location.longitude === 'number'
      && typeof location.radius_meters === 'number'
      ? {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: location.radius_meters,
          },
        }
      : {}),
  };
}

function isSearchResponse(value: unknown): value is SearchResponseV1 {
  return value !== null
    && typeof value === 'object'
    && Array.isArray((value as SearchResponseV1).results)
    && (value as SearchResponseV1).results.every((result) => typeof result.canonicalId === 'string');
}
