import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import {
  collectDay2ExpandedReviewPacket,
  DAY2_SELECTED_QUERY_IDS,
  renderDay2ReviewMarkdownV11,
  type Day2ReviewPacketV11,
} from './day2-review-packet.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.sha256', root);
const packetJsonUrl = new URL('evaluation/judgments/day2-review-packet.v1.1.json', root);
const packetMarkdownUrl = new URL('evaluation/judgments/day2-review-packet.v1.1.md', root);
const packetChecksumUrl = new URL('evaluation/judgments/day2-review-packet.v1.1.sha256', root);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const fixtureInputs = [
  { sourceKey: 'OSM_OVERPASS', path: 'packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json' },
  { sourceKey: 'JONKOPING_MUNICIPAL_UTEGYM', path: 'packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json' },
] as const;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const partRanges = [[0, 5], [5, 10], [10, 14]] as const;
const partArgument = process.argv.find((argument) => argument.startsWith('--part='));
const combine = process.argv.includes('--combine');

if (combine) {
  const parts = await Promise.all(partRanges.map((_, index) => readFile(
    `/tmp/lemon-day2-review-v1.1-part-${index + 1}.json`,
    'utf8',
  ).then((text) => JSON.parse(text) as Day2ReviewPacketV11)));
  const [first] = parts;
  if (!first || parts.some((part) => part.datasetManifestChecksum !== first.datasetManifestChecksum
    || part.datasetInventoryChecksum !== first.datasetInventoryChecksum)) {
    throw new Error('DAY2_REVIEW_PART_PIN_MISMATCH');
  }
  const packet: Day2ReviewPacketV11 = {
    ...first,
    queries: parts.flatMap(({ queries }) => queries),
  };
  if (packet.queries.map(({ queryId }) => queryId).join('\n') !== DAY2_SELECTED_QUERY_IDS.join('\n')) {
    throw new Error('DAY2_REVIEW_PART_ORDER_MISMATCH');
  }
  const packetText = `${JSON.stringify(packet, null, 2)}\n`;
  await Promise.all([
    writeFile(packetJsonUrl, packetText, { flag: 'wx' }),
    writeFile(packetMarkdownUrl, renderDay2ReviewMarkdownV11(packet), { flag: 'wx' }),
    writeFile(packetChecksumUrl, `${hash(packetText)}\n`, { flag: 'wx' }),
  ]);
  console.log(JSON.stringify({
    manifestChecksum: packet.datasetManifestChecksum,
    datasetInventoryChecksum: packet.datasetInventoryChecksum,
    queries: packet.queries.length,
    eligibleEntities: new Set(packet.queries.flatMap(({ entityReviewRows }) => entityReviewRows
      .map(({ canonicalEntityId }) => canonicalEntityId))).size,
    reviewRows: packet.queries.reduce((sum, query) => sum + query.entityReviewRows.length, 0),
    populatedGrades: packet.queries.flatMap(({ entityReviewRows }) => entityReviewRows)
      .filter(({ grade }) => grade !== null).length,
  }));
  process.exit(0);
}

const part = partArgument ? Number(partArgument.slice('--part='.length)) : 0;
if (!Number.isInteger(part) || part < 1 || part > partRanges.length) {
  throw new Error('DAY2_REVIEW_PART_REQUIRED');
}

const [manifestText, manifestChecksum, corpusText, corpusChecksum, ...fixtureTexts] = await Promise.all([
  readFile(manifestUrl, 'utf8'),
  readFile(manifestChecksumUrl, 'utf8'),
  readFile(corpusUrl, 'utf8'),
  readFile(corpusChecksumUrl, 'utf8'),
  ...fixtureInputs.map(({ path }) => readFile(new URL(path, root), 'utf8')),
]);
if (hash(manifestText) !== manifestChecksum.trim()) throw new Error('DAY2_MANIFEST_CHECKSUM_MISMATCH');
const codeGitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const { manifest, packet } = await collectDay2ExpandedReviewPacket({
  connectionString: process.env.LEMON_LOCAL_DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  edgeUrl: process.env.LEMON_LOCAL_EDGE_URL ?? 'http://127.0.0.1:54321/functions/v1/search',
  corpusText,
  corpusChecksum: corpusChecksum.trim(),
  codeGitCommit,
  fixtureFiles: fixtureInputs.map((fixture, index) => ({ ...fixture, text: fixtureTexts[index]! })),
  queryIds: DAY2_SELECTED_QUERY_IDS.slice(...partRanges[part - 1]!),
});
const reconstructedManifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (reconstructedManifestText !== manifestText) throw new Error('IMMUTABLE_DAY2_MANIFEST_MISMATCH');
if (packet.datasetManifestChecksum !== hash(manifestText)) throw new Error('PACKET_MANIFEST_PIN_MISMATCH');
await writeFile(`/tmp/lemon-day2-review-v1.1-part-${part}.json`, `${JSON.stringify(packet, null, 2)}\n`);
console.log(JSON.stringify({
  part,
  manifestChecksum: packet.datasetManifestChecksum,
  datasetInventoryChecksum: packet.datasetInventoryChecksum,
  queries: packet.queries.length,
  eligibleEntities: new Set(packet.queries.flatMap(({ entityReviewRows }) => entityReviewRows
    .map(({ canonicalEntityId }) => canonicalEntityId))).size,
  reviewRows: packet.queries.reduce((sum, query) => sum + query.entityReviewRows.length, 0),
  populatedGrades: packet.queries.flatMap(({ entityReviewRows }) => entityReviewRows)
    .filter(({ grade }) => grade !== null).length,
}));
