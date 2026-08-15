import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  loadTuningJudgments,
  readCorpus,
  sha256,
  validateCorpus,
  validateDatasetManifest,
  validateJudgmentSet,
  validateScaffolds,
} from '../../packages/evaluation/validation/corpus.mjs';
import {
  DAY2_SELECTED_QUERY_IDS,
  loadSelectedDevQueries,
} from '../../packages/evaluation/src/day2-review-packet.ts';

describe('EVAL-01 corpus foundation', () => {
  it('validates frozen allocation, identity, taxonomy references, and pairs', async () => {
    const result = await validateCorpus();
    expect(result.records).toHaveLength(110);
    expect(result.pairGroupCount).toBe(12);
  });

  it('has a deterministic checksum and identity mutations change it', async () => {
    const { text, expectedChecksum } = await readCorpus();
    expect(sha256(text)).toBe(expectedChecksum);
    expect(sha256(text.replace('Rosenlunds rosarium', 'Rosenlunds rosarium changed'))).not.toBe(expectedChecksum);
  });

  it('validates without rewriting the released corpus', async () => {
    const before = await readCorpus();
    await validateCorpus();
    const after = await readCorpus();
    expect(after.text).toBe(before.text);
    expect(after.expectedChecksum).toBe(before.expectedChecksum);
  });

  it('validates the empty DEV judgment and dataset manifest scaffolds', async () => {
    const { judgments, manifest } = await validateScaffolds();
    expect(validateJudgmentSet(judgments).records).toEqual([]);
    expect(validateDatasetManifest(manifest).status).toBe('SCAFFOLD_UNBOUND');
  });

  it('allows a frozen deterministic manifest to explicitly omit a non-participating model', async () => {
    const { manifest } = await validateScaffolds();
    expect(validateDatasetManifest({
      ...manifest,
      status: 'FROZEN',
      canonical_dataset_version: 'fixture-dataset.v1',
      source_record_ingestion_run_ids: ['10000000-0000-4000-8000-000000000001'],
      normalization_version: 'norm-v1',
      search_config_version: 'search-config.v1',
      code_git_commit: 'fixture-commit',
      judgment: { version: 'judgments.dev.fixture', checksum: 'a'.repeat(64) },
      search_documents: {
        template_version: 'search-document-template-v1',
        document_version: 'search-document-v1',
        hashes: ['b'.repeat(64)],
      },
      embedding: { provider: null, model: null, revision: null, dimension: null },
    }).status).toBe('FROZEN');
  });

  it('freezes the prescribed representative Day-2 DEV selection without unsupported families', async () => {
    const { text } = await readCorpus();
    const selected = await loadSelectedDevQueries(text);
    expect(selected.map(({ query_id: queryId }) => queryId)).toEqual(DAY2_SELECTED_QUERY_IDS);
    expect(selected).toHaveLength(14);
    expect(selected.every(({ split }) => split === 'DEV')).toBe(true);
    expect(selected.some(({ family }) => ['semantic_occasion_language', 'event_time'].includes(family))).toBe(false);
  });

  it('validates the immutable Day-2 dataset freeze before human judgment is populated', async () => {
    const manifest = JSON.parse(await readFile(
      new URL('../../evaluation/manifests/dataset-manifest.day2.v1.json', import.meta.url),
      'utf8',
    ));
    expect(validateDatasetManifest(manifest).judgment).toEqual({ version: null, checksum: null });
  });

  it('keeps the corrected Day-2 human pool exhaustive and entirely ungraded', async () => {
    const [manifestText, packetText] = await Promise.all([
      readFile(new URL('../../evaluation/manifests/dataset-manifest.day2.v1.json', import.meta.url), 'utf8'),
      readFile(new URL('../../evaluation/judgments/day2-review-packet.v1.1.json', import.meta.url), 'utf8'),
    ]);
    const packet = JSON.parse(packetText);
    expect(packet.datasetManifestChecksum).toBe(sha256(manifestText));
    expect(packet.queries).toHaveLength(14);
    expect(packet.queries.every((query: { entityReviewRows: unknown[] }) => query.entityReviewRows.length === 6))
      .toBe(true);
    expect(packet.queries.flatMap((query: { entityReviewRows: Array<{ grade: unknown }> }) => query.entityReviewRows)
      .every(({ grade }: { grade: unknown }) => grade === null)).toBe(true);
    expect(packet.queries.filter((query: { targetInventoryStatus: string }) => (
      query.targetInventoryStatus === 'TARGET_NOT_IN_FROZEN_DATASET'
    )).every((query: { primaryTargetFailureAttribution: string }) => (
      query.primaryTargetFailureAttribution === 'INVENTORY'
    ))).toBe(true);
  });

  it('freezes a DEV-only EVAL-03 review packet without assigning human grades', async () => {
    const root = new URL('../../', import.meta.url);
    const [manifestText, manifestChecksum, packetText, packetChecksum] = await Promise.all([
      readFile(new URL('evaluation/manifests/dataset-manifest.day3-current.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/manifests/dataset-manifest.day3-current.v1.sha256', root), 'utf8'),
      readFile(new URL('evaluation/judgments/dev-review-packet.day3.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/judgments/dev-review-packet.day3.v1.sha256', root), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText);
    const packet = JSON.parse(packetText);
    expect(sha256(manifestText)).toBe(manifestChecksum.trim());
    expect(sha256(packetText)).toBe(packetChecksum.trim());
    expect(packet.dataset_manifest).toEqual({
      version: manifest.manifest_version,
      checksum: sha256(manifestText),
    });
    expect(packet.split).toBe('DEV');
    expect(packet.queries).toHaveLength(60);
    expect(packet.current_dataset_judgments_complete).toBe(0);
    expect(packet.current_dataset_judgments_missing).toBe(60);
    expect(packet.queries.flatMap((query: { candidatePool: Array<{ grade: unknown }> }) => query.candidatePool)
      .every(({ grade }: { grade: unknown }) => grade === null)).toBe(true);
    expect(packet.held_out_guard).toEqual({
      parsed_splits: ['DEV'],
      sealed_queries_executed: 0,
      adversarial_queries_executed: 0,
      sealed_or_adversarial_judgments_loaded: false,
    });
    expect(manifest.judgment).toMatchObject({
      prior_version: 'judgments.day2.v1',
      prior_version_compatible_with_current_inventory: false,
    });
  });

  it('rejects SEALED, ADVERSARIAL, and generic all tuning access', async () => {
    await expect(loadTuningJudgments('SEALED')).rejects.toThrow('access denied');
    await expect(loadTuningJudgments('ADVERSARIAL')).rejects.toThrow('access denied');
    await expect(loadTuningJudgments('all')).rejects.toThrow('access denied');
  });

  it('ships repository schemas with frozen required fields', async () => {
    const paths = ['corpus-record.v1.schema.json', 'judgment-set.v1.schema.json', 'dataset-manifest.v1.schema.json'];
    for (const path of paths) {
      const schema = JSON.parse(await readFile(new URL(`../../packages/evaluation/schemas/${path}`, import.meta.url), 'utf8'));
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.length).toBeGreaterThan(0);
    }
  });
});
