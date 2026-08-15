import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import {
  collectDay2Artifacts,
  renderDay2ReviewMarkdown,
} from './day2-review-packet.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.sha256', root);
const packetJsonUrl = new URL('evaluation/judgments/day2-review-packet.v1.json', root);
const packetMarkdownUrl = new URL('evaluation/judgments/day2-review-packet.v1.md', root);
const packetChecksumUrl = new URL('evaluation/judgments/day2-review-packet.v1.sha256', root);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const fixtureInputs = [
  { sourceKey: 'OSM_OVERPASS', path: 'packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json' },
  { sourceKey: 'JONKOPING_MUNICIPAL_UTEGYM', path: 'packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json' },
] as const;

const [corpusText, corpusChecksum, ...fixtureTexts] = await Promise.all([
  readFile(corpusUrl, 'utf8'),
  readFile(corpusChecksumUrl, 'utf8'),
  ...fixtureInputs.map(({ path }) => readFile(new URL(path, root), 'utf8')),
]);
const codeGitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const { manifest, packet } = await collectDay2Artifacts({
  connectionString: process.env.LEMON_LOCAL_DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  edgeUrl: process.env.LEMON_LOCAL_EDGE_URL ?? 'http://127.0.0.1:54321/functions/v1/search',
  corpusText,
  corpusChecksum: corpusChecksum.trim(),
  codeGitCommit,
  fixtureFiles: fixtureInputs.map((fixture, index) => ({ ...fixture, text: fixtureTexts[index]! })),
});
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const packetText = `${JSON.stringify(packet, null, 2)}\n`;
const checksum = (text: string) => createHash('sha256').update(text).digest('hex');
const existingManifestText = await readFile(manifestUrl, 'utf8').catch((error: unknown) => {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
  throw error;
});
if (existingManifestText !== null && existingManifestText !== manifestText) {
  throw new Error('IMMUTABLE_DAY2_MANIFEST_MISMATCH');
}
await mkdir(new URL('evaluation/judgments/', root), { recursive: true });
const writes = [
  writeFile(packetJsonUrl, packetText, { flag: 'wx' }),
  writeFile(packetMarkdownUrl, renderDay2ReviewMarkdown(packet), { flag: 'wx' }),
  writeFile(packetChecksumUrl, `${checksum(packetText)}\n`, { flag: 'wx' }),
];
if (existingManifestText === null) {
  writes.push(
    writeFile(manifestUrl, manifestText, { flag: 'wx' }),
    writeFile(manifestChecksumUrl, `${checksum(manifestText)}\n`, { flag: 'wx' }),
  );
}
await Promise.all(writes);
console.log(JSON.stringify({
  manifestVersion: manifest.manifest_version,
  datasetChecksum: manifest.dataset_inventory?.checksum,
  selectedQueries: packet.queries.length,
  capturedResults: packet.queries.reduce((sum, query) => sum + query.results.length, 0),
  populatedGrades: packet.queries.flatMap(({ results }) => results).filter(({ grade }) => grade !== null).length,
}));
