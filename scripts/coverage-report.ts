import { mkdir, writeFile } from 'node:fs/promises';
import {
  fixtureDatabaseUrl,
  generateCoverageDocument,
  prepareLocalTaxonomyRuntime,
  renderCoverageMarkdown,
} from '../packages/ingestion-domain/src/index.ts';

const connectionString = fixtureDatabaseUrl();
await prepareLocalTaxonomyRuntime(connectionString);
const document = await generateCoverageDocument(connectionString, {
  generatedAt: process.env.COVERAGE_GENERATED_AT,
});
const outputDirectory = new URL('../artifacts/coverage/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL('active-going-out.v1.json', outputDirectory), `${JSON.stringify(document, null, 2)}\n`),
  writeFile(new URL('active-going-out.v1.md', outputDirectory), renderCoverageMarkdown(document)),
]);
console.log(JSON.stringify({
  leaves: document.leaves.length,
  statusCounts: document.statusCounts,
  contentChecksum: document.contentChecksum,
}));
