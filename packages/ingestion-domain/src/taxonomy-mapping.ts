import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

const MAPPING_PATH = new URL('../../../reference/taxonomy/source-mappings.v1.yaml', import.meta.url);
const MAPPING_CHECKSUM_PATH = new URL('../../../reference/taxonomy/source-mappings.v1.sha256', import.meta.url);
const TAXONOMY_PATH = new URL('../../../reference/taxonomy/active-going-out.v1.yaml', import.meta.url);
const TAXONOMY_CHECKSUM_PATH = new URL('../../../reference/taxonomy/checksum.txt', import.meta.url);

export const TAXONOMY_VERSION = 'active-going-out.v1';
export const TAXONOMY_MAPPING_VERSION = 'source-taxonomy.v1';

export type AutomaticMembershipMethod = 'SOURCE_FACT' | 'DETERMINISTIC_MAP';

export type SourceMappingRule = {
  id: string;
  source_key: 'OSM_OVERPASS' | 'JONKOPING_MUNICIPAL_UTEGYM';
  source_field: 'sourceCategories';
  source_tag: string;
  source_value: string;
  target_slug: string;
  method: AutomaticMembershipMethod;
  evidence_requirements: string[];
};

export type SourceMappingCatalog = {
  mapping_version: string;
  taxonomy_version: string;
  taxonomy_checksum: string;
  rules: SourceMappingRule[];
  taxonomyNodes: Array<{
    id: string;
    slug: string;
    active: boolean;
    is_leaf: boolean;
  }>;
  mappingChecksum: string;
};

type EvidenceRow = {
  source_key: string;
  source_record_id: string;
  source_record_version_id: string;
  source_record_parse_attempt_id: string;
  normalized_output: unknown;
};

export async function loadSourceMappingCatalog(): Promise<SourceMappingCatalog> {
  const [mappingText, expectedMappingChecksum, taxonomyText, expectedTaxonomyChecksum] = await Promise.all([
    readFile(MAPPING_PATH, 'utf8'),
    readFile(MAPPING_CHECKSUM_PATH, 'utf8'),
    readFile(TAXONOMY_PATH, 'utf8'),
    readFile(TAXONOMY_CHECKSUM_PATH, 'utf8'),
  ]);
  const mappingChecksum = sha256(mappingText);
  const taxonomyChecksum = sha256(taxonomyText);
  if (mappingChecksum !== expectedMappingChecksum.trim()) {
    throw new Error('source mapping checksum does not match source-mappings.v1.yaml');
  }
  if (taxonomyChecksum !== expectedTaxonomyChecksum.trim()) {
    throw new Error('active taxonomy checksum does not match its reference artifact');
  }

  const rawCatalog: unknown = JSON.parse(mappingText);
  const rawTaxonomy: unknown = JSON.parse(taxonomyText);
  if (!isObject(rawCatalog) || !Array.isArray(rawCatalog.rules)
    || !isObject(rawTaxonomy) || !Array.isArray(rawTaxonomy.nodes)) {
    throw new Error('taxonomy mapping or taxonomy reference schema is invalid');
  }
  const nodes = rawTaxonomy.nodes.map(readTaxonomyNode);
  const rules = rawCatalog.rules.map(readMappingRule);
  if (rawCatalog.mapping_version !== TAXONOMY_MAPPING_VERSION
    || rawCatalog.taxonomy_version !== TAXONOMY_VERSION
    || rawCatalog.taxonomy_checksum !== taxonomyChecksum
    || rawTaxonomy.taxonomy_version !== TAXONOMY_VERSION) {
    throw new Error('taxonomy mapping catalogue identity does not match active REF-01 truth');
  }
  if (new Set(rules.map(({ id }) => id)).size !== rules.length) {
    throw new Error('taxonomy mapping rule IDs must be unique');
  }
  const activeNodes = new Map(nodes.filter(({ active }) => active).map((node) => [node.slug, node]));
  for (const rule of rules) {
    if (!activeNodes.has(rule.target_slug)) {
      throw new Error(`taxonomy mapping rule ${rule.id} references a missing or inactive node`);
    }
  }
  return {
    mapping_version: rawCatalog.mapping_version,
    taxonomy_version: rawCatalog.taxonomy_version,
    taxonomy_checksum: rawCatalog.taxonomy_checksum,
    rules,
    taxonomyNodes: nodes,
    mappingChecksum,
  };
}

export function matchTaxonomyRules(
  catalog: SourceMappingCatalog,
  sourceKey: string,
  sourceCategories: string[],
): SourceMappingRule[] {
  const exactCategories = new Set(sourceCategories);
  return catalog.rules.filter((rule) => rule.source_key === sourceKey
    && exactCategories.has(`${rule.source_tag}=${rule.source_value}`));
}

export async function prepareLocalTaxonomyRuntime(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('taxonomy role preparation is restricted to a local database');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion, lemon_reviewer to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function applyTaxonomyMappings(
  connectionString: string,
  catalog?: SourceMappingCatalog,
): Promise<{ evidenceExecutions: number; matchedRules: number; membershipsCreated: number; membershipIds: string[] }> {
  catalog ??= await loadSourceMappingCatalog();
  const sourceKeys = [...new Set(catalog.rules.map(({ source_key }) => source_key))].sort();
  const nodeIds = new Map(catalog.taxonomyNodes.map((node) => [node.slug, node.id]));
  return controlledTransaction(connectionString, 'lemon_ingestion', async (client) => {
    const evidence = (await client.query<EvidenceRow>(`
      select source.key as source_key,
             record.id as source_record_id,
             record.current_version_id as source_record_version_id,
             record.current_parse_attempt_id as source_record_parse_attempt_id,
             attempt.normalized_output
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      join app.source_record_versions as version on version.id = record.current_version_id
      join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      where source.key = any($1::text[])
        and source.enabled
        and record.canonical_entity_id is not null
        and version.content_status = 'AVAILABLE'
        and attempt.status = 'SUCCEEDED'
        and attempt.normalized_output is not null
        and attempt.output_redacted_at is null
      order by source.key, record.id
    `, [sourceKeys])).rows;
    const existingIds = new Set((await client.query<{ id: string }>(`
      select id from app.entity_taxonomy_memberships
    `)).rows.map(({ id }) => id));
    const membershipIds = new Set<string>();
    let matchedRules = 0;
    let membershipsCreated = 0;

    for (const row of evidence) {
      const categories = readSourceCategories(row.normalized_output);
      for (const rule of matchTaxonomyRules(catalog, row.source_key, categories)) {
        matchedRules += 1;
        const nodeId = nodeIds.get(rule.target_slug);
        if (!nodeId) throw new Error(`active taxonomy node disappeared for ${rule.target_slug}`);
        const mappingRef = rule.method === 'DETERMINISTIC_MAP'
          ? `${catalog.mapping_version}:${rule.id}:${rule.target_slug}`
          : null;
        const result = await client.query<{ id: string }>(`
          select app.apply_source_taxonomy_membership(
            $1, $2, $3, $4, $5::app.taxonomy_membership_method, $6
          ) as id
        `, [
          row.source_record_id,
          row.source_record_version_id,
          row.source_record_parse_attempt_id,
          nodeId,
          rule.method,
          mappingRef,
        ]);
        const membershipId = result.rows[0]?.id;
        if (!membershipId) throw new Error('source taxonomy membership operation returned no ID');
        if (!existingIds.has(membershipId)) {
          membershipsCreated += 1;
          existingIds.add(membershipId);
        }
        membershipIds.add(membershipId);
      }
    }
    return {
      evidenceExecutions: evidence.length,
      matchedRules,
      membershipsCreated,
      membershipIds: [...membershipIds].sort(),
    };
  });
}

export async function addManualTaxonomyMembership(
  connectionString: string,
  input: {
    entityId: string;
    taxonomyNodeId: string;
    taxonomyVersion: string;
    reviewer: string;
    evidence: string;
    expectedCurrentMembershipId?: string | null;
  },
): Promise<string> {
  return controlledTransaction(connectionString, 'lemon_reviewer', async (client) => {
    const result = await client.query<{ id: string }>(`
      select app.add_manual_taxonomy_membership($1, $2, $3, $4, $5, $6) as id
    `, [
      input.entityId,
      input.taxonomyNodeId,
      input.taxonomyVersion,
      input.reviewer,
      input.evidence,
      input.expectedCurrentMembershipId ?? null,
    ]);
    const membershipId = result.rows[0]?.id;
    if (!membershipId) throw new Error('manual taxonomy membership operation returned no ID');
    return membershipId;
  });
}

async function controlledTransaction<T>(
  connectionString: string,
  role: 'lemon_ingestion' | 'lemon_reviewer',
  operation: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

function readMappingRule(value: unknown): SourceMappingRule {
  if (!isObject(value)
    || typeof value.id !== 'string' || value.id.trim() === ''
    || !['OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM'].includes(String(value.source_key))
    || value.source_field !== 'sourceCategories'
    || typeof value.source_tag !== 'string' || value.source_tag.trim() === ''
    || typeof value.source_value !== 'string' || value.source_value.trim() === ''
    || typeof value.target_slug !== 'string' || value.target_slug.trim() === ''
    || !['SOURCE_FACT', 'DETERMINISTIC_MAP'].includes(String(value.method))
    || !Array.isArray(value.evidence_requirements)
    || value.evidence_requirements.length !== 4
    || value.evidence_requirements.some((requirement) => typeof requirement !== 'string')
  ) {
    throw new Error('source taxonomy mapping rule schema is invalid');
  }
  const requiredEvidence = new Set(value.evidence_requirements);
  for (const requirement of [
    'current_version', 'current_successful_parse_attempt',
    'exact_source_category', 'resolved_canonical_entity',
  ]) {
    if (!requiredEvidence.has(requirement)) {
      throw new Error(`source taxonomy mapping rule ${value.id} lacks ${requirement}`);
    }
  }
  return value as SourceMappingRule;
}

function readTaxonomyNode(value: unknown): SourceMappingCatalog['taxonomyNodes'][number] {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.slug !== 'string'
    || typeof value.active !== 'boolean' || typeof value.is_leaf !== 'boolean') {
    throw new Error('active taxonomy node schema is invalid');
  }
  return { id: value.id, slug: value.slug, active: value.active, is_leaf: value.is_leaf };
}

function readSourceCategories(value: unknown): string[] {
  if (!isObject(value) || !Array.isArray(value.sourceCategories)) return [];
  return value.sourceCategories.filter((category): category is string => typeof category === 'string');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
