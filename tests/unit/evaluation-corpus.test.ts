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
