import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const taxonomyPath = new URL('../reference/taxonomy/active-going-out.v1.yaml', import.meta.url);
const checksumPath = new URL('../reference/taxonomy/checksum.txt', import.meta.url);
const boundaryPath = new URL('../reference/geography/jonkoping-municipality.lm-current-2026-08-14.geojson', import.meta.url);
const metadataPath = new URL('../reference/geography/metadata.yaml', import.meta.url);
const sourceMappingsPath = new URL('../reference/taxonomy/source-mappings.v1.yaml', import.meta.url);
const sourceMappingsChecksumPath = new URL('../reference/taxonomy/source-mappings.v1.sha256', import.meta.url);

const [
  taxonomyText,
  expectedChecksum,
  boundaryText,
  metadataText,
  sourceMappingsText,
  expectedSourceMappingsChecksum,
] = await Promise.all([
  readFile(taxonomyPath, 'utf8'),
  readFile(checksumPath, 'utf8'),
  readFile(boundaryPath, 'utf8'),
  readFile(metadataPath, 'utf8'),
  readFile(sourceMappingsPath, 'utf8'),
  readFile(sourceMappingsChecksumPath, 'utf8'),
]);
const taxonomy = JSON.parse(taxonomyText);
const boundary = JSON.parse(boundaryText);
const metadata = JSON.parse(metadataText);
const sourceMappings = JSON.parse(sourceMappingsText);
const checksum = createHash('sha256').update(taxonomyText).digest('hex');
const boundaryChecksum = createHash('sha256').update(boundaryText).digest('hex');
const sourceMappingsChecksum = createHash('sha256').update(sourceMappingsText).digest('hex');

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
if (sourceMappingsChecksum !== expectedSourceMappingsChecksum.trim()
  || sourceMappings.mapping_version !== 'source-taxonomy.v1'
  || sourceMappings.taxonomy_version !== taxonomy.taxonomy_version
  || sourceMappings.taxonomy_checksum !== checksum) {
  throw new Error('source taxonomy mapping identity or checksum is invalid');
}
const activeTaxonomySlugs = new Set(taxonomy.nodes.filter(({ active }) => active).map(({ slug }) => slug));
if (new Set(sourceMappings.rules.map(({ id }) => id)).size !== sourceMappings.rules.length
  || sourceMappings.rules.some(({ method, target_slug, source_field }) => (
    !['SOURCE_FACT', 'DETERMINISTIC_MAP'].includes(method)
      || !activeTaxonomySlugs.has(target_slug)
      || source_field !== 'sourceCategories'
  ))) {
  throw new Error('source taxonomy mapping rules are invalid');
}

console.log(`reference artifacts valid: ${taxonomy.nodes.length} taxonomy nodes, ${sourceMappings.rules.length} source mappings`);
