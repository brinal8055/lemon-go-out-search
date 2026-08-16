import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

describe('DEMO-RELEASE-01 pin', () => {
  it('pins the accepted demo candidate without claiming a final evaluation freeze', async () => {
    const [reportText, summary] = await Promise.all([
      readFile(new URL('evaluation/reports/demo-release-01/demo-release.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/reports/demo-release-01/demo-release.v1.md', root), 'utf8'),
    ]);
    const report = JSON.parse(reportText) as {
      task: string;
      repository: { demo_git_pin: string; working_tree_clean_at_start: boolean; committed_secret_scan: string };
      candidate: { candidate_version: string; rrf: { version: string; k: number }; semantic: { model: string; dimension: number; timeout_ms: number; ann: boolean } };
      canonical_dataset_manifest: { checksum: string };
      hosted_corpus: { counts: Record<string, number>; search_document_logical_identity: string; embedding_fingerprint_identity: string };
      edge: { function: string; status: string; public_path: string; redeployed: boolean };
      deployed_demo_smoke: Array<{ key: string; http_status: number; result_count: number }>;
      status: Record<string, boolean | string>;
      guards: Record<string, boolean>;
    };

    expect(report.task).toBe('DEMO-RELEASE-01');
    expect(report.repository).toMatchObject({
      demo_git_pin: 'a9e922dcf7b1c092cc8076e776a5c2301ce62e1a',
      working_tree_clean_at_start: true,
      committed_secret_scan: 'PASS',
    });
    expect(report.candidate).toMatchObject({
      candidate_version: 'eval-03-baseline.v1', rrf: { version: 'RRF_V1', k: 60 },
      semantic: { model: 'voyage-4', dimension: 1024, timeout_ms: 700, ann: false },
    });
    expect(report.canonical_dataset_manifest.checksum).toBe('f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82');
    expect(report.hosted_corpus.counts).toMatchObject({
      publishedPlaces: 392, publishedEvents: 3, activeSearchDocuments: 395,
      compatibleReadyEmbeddings: 395, fixtureContamination: 0,
    });
    expect(report.hosted_corpus.search_document_logical_identity).toBe('7e5d83ebeee39595944b9ef1bdb5cca8f72ff5aa6a2e2880471b6c4963981a51');
    expect(report.hosted_corpus.embedding_fingerprint_identity).toBe('6ad7ad8fb1d6902de8ee4dbbb66042050ed732789ed4ee7e8a0dbbd46f38f20b');
    expect(report.edge).toEqual({
      function: 'search', status: 'ACTIVE', management_identity: { version: null, updated_at: null },
      endpoint_reachable: true, public_path: 'Edge -> api.search_v1', redeployed: false,
    });
    expect(report.deployed_demo_smoke.map(({ key }) => key)).toEqual([
      'direct_canonical', 'category_discovery', 'semantic_english', 'semantic_swedish', 'live_event',
    ]);
    expect(report.deployed_demo_smoke.every(({ http_status, result_count }) => http_status === 200 && result_count > 0)).toBe(true);
    expect(report.status).toEqual({
      DEMO_RELEASE_READY: true, DEMO_CORPUS_LOGICAL_IDENTITY: 'VERIFIED', REPRESENTATION_ONLY_DRIFT: 'ACKNOWLEDGED',
      FINAL_EVALUATION_CANDIDATE_FROZEN: false, PERF_REVALIDATION_STATUS: 'BLOCKED_DEFERRED',
      SEALED_ACCESSED: false, ADVERSARIAL_ACCESSED: false,
    });
    expect(report.guards).toMatchObject({
      read_only_remote_operations: true, corpus_mutated: false, embeddings_mutated: false,
      judgments_mutated: false, search_or_runtime_behavior_changed: false,
    });
    expect(summary).toContain('DEMO_RELEASE_READY = TRUE');
    expect(summary).toContain('FINAL_EVALUATION_CANDIDATE_FROZEN = FALSE');
    expect(summary).toContain('PERF_REVALIDATION_STATUS = BLOCKED_DEFERRED');
    expect(summary).toContain('SEALED_ACCESSED = FALSE');
    expect(summary).toContain('ADVERSARIAL_ACCESSED = FALSE');
  });
});
