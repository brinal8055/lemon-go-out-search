import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const taxonomyPath = new URL('../reference/taxonomy/active-going-out.v1.yaml', import.meta.url);
const checksumPath = new URL('../reference/taxonomy/checksum.txt', import.meta.url);
const boundaryPath = new URL('../reference/geography/jonkoping-municipality.lm-current-2026-08-14.geojson', import.meta.url);
const metadataPath = new URL('../reference/geography/metadata.yaml', import.meta.url);

const [taxonomyText, expectedChecksum, boundaryText, metadataText] = await Promise.all([
  readFile(taxonomyPath, 'utf8'),
  readFile(checksumPath, 'utf8'),
  readFile(boundaryPath, 'utf8'),
  readFile(metadataPath, 'utf8'),
]);
const taxonomy = JSON.parse(taxonomyText);
const boundary = JSON.parse(boundaryText);
const metadata = JSON.parse(metadataText);
const checksum = createHash('sha256').update(taxonomyText).digest('hex');
const boundaryChecksum = createHash('sha256').update(boundaryText).digest('hex');

if (checksum !== expectedChecksum.trim()) {
  throw new Error('taxonomy checksum does not match active-going-out.v1.yaml');
}
if (taxonomy.taxonomy_version !== 'active-going-out.v1' || taxonomy.nodes.length !== 52) {
  throw new Error('active taxonomy identity or node count is invalid');
}
if (new Set(taxonomy.nodes.map((node) => node.id)).size !== taxonomy.nodes.length
  || new Set(taxonomy.nodes.map((node) => node.slug)).size !== taxonomy.nodes.length) {
  throw new Error('taxonomy IDs or slugs are not stable and unique');
}
if (boundary.type !== 'Feature' || boundary.geometry?.type !== 'MultiPolygon'
  || metadata.target_srid !== 4326 || metadata.timezone !== 'Europe/Stockholm') {
  throw new Error('Jönköping boundary artifact is not the required EPSG:4326 MultiPolygon scope');
}
if (boundaryChecksum !== metadata.artifact_sha256) {
  throw new Error('boundary checksum does not match metadata.yaml');
}

console.log(`reference artifacts valid: ${taxonomy.nodes.length} taxonomy nodes`);
