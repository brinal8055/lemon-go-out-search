export type EvalSplit = 'DEV' | 'SEALED' | 'ADVERSARIAL';
export type EvalLanguage = 'en' | 'sv' | 'mixed' | 'language-neutral';
export type RelevanceGrade = 0 | 1 | 2 | 3;

export type EvalCorpusRecordV1 = {
  query_id: string;
  corpus_version: 'corpus.v1';
  query: string;
  family: string;
  split: EvalSplit;
  language: EvalLanguage;
  pair_group_id: string | null;
  ui_locale: 'en' | 'sv';
  scope: {
    scope_id: string;
    scope_slug: string;
    boundary_id: string;
    boundary_version: string;
  };
  request_filters: Record<string, unknown>;
  evaluation_clock_utc: string | null;
  hard_constraints: string[];
  intended_assertions: string[];
  known_item_target: Record<string, unknown> | null;
  rationale: string;
  human_review_flags: string[];
};

export type EvalJudgmentRecordV1 = {
  judgment_version: string;
  query_id: string;
  relevant: Array<{ entity_id: string; grade: RelevanceGrade }>;
  known_item_target: string | null;
  acceptable_taxonomy_node_ids: string[];
  acceptable_group_keys: string[];
  expected_protected_behavior: string[];
  expected_ineligible_behavior: string[];
  rationale: string;
  judged_by: string;
  judged_at: string;
  dataset_version: string;
  taxonomy_checksum: string;
  boundary_version: string;
  query_text?: string;
  known_item_inventory_status?: 'TARGET_NOT_IN_FROZEN_DATASET' | 'TARGET_MATCHED' | 'NOT_APPLICABLE';
  primary_failure_attribution?: 'INVENTORY' | null;
  search_ranking_assessment?: 'EVALUATED' | 'NOT_EVALUATED';
  approved_target_decision?: {
    status: string;
    matched_entity_ids: string[];
    additional_highly_relevant_entity_ids?: string[];
  } | null;
};

export type EvalJudgmentSetV1 = {
  judgment_version: string;
  status: 'SCAFFOLD_UNBOUND' | 'FROZEN';
  split: EvalSplit;
  corpus_version: 'corpus.v1';
  corpus_checksum: string;
  dataset_version: string | null;
  taxonomy_checksum: string;
  boundary_version: string;
  hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY';
  records: EvalJudgmentRecordV1[];
  dataset_manifest_version?: string;
  dataset_manifest_checksum?: string;
  dataset_inventory_checksum?: string;
  selected_query_ids?: string[];
  approval?: { authority: string; provenance: string };
  freeze_metadata?: {
    created_at: string;
    review_source: string;
    approved_proposal: string;
    approved_proposal_sha256: string;
    grading_rubric: Record<string, unknown>;
    grading_rubric_version: string;
  };
};

export type EvalDatasetManifestV1 = {
  manifest_version: string;
  status: 'SCAFFOLD_UNBOUND' | 'FROZEN';
  canonical_dataset_version: string | null;
  source_record_ingestion_run_ids: string[];
  boundary: { id: string; version: string; checksum: string };
  taxonomy: { version: string; checksum: string };
  normalization_version: string | null;
  search_documents: {
    template_version: string | null;
    document_version: string | null;
    hashes: string[];
  };
  embedding: {
    provider: string | null;
    model: string | null;
    revision: string | null;
    dimension: number | null;
  };
  search_config_version: string | null;
  evaluation_clock_utc: string;
  corpus: { version: 'corpus.v1'; checksum: string };
  judgment: { version: string | null; checksum: string | null };
  code_git_commit: string | null;
  code_state?: string;
  dataset_inventory?: {
    eligible_published_entities: number;
    active_search_documents: number;
    checksum: string;
  };
  source_fixtures?: Array<{
    source_key: string;
    path: string;
    checksum: string;
    ingestion_run_id: string;
  }>;
  capabilities?: {
    exact: 'IMPLEMENTED';
    alias: 'IMPLEMENTED';
    accentless: 'IMPLEMENTED';
    prefix: 'IMPLEMENTED';
    trigram: 'IMPLEMENTED';
    fts: 'IMPLEMENTED';
    taxonomy: 'IMPLEMENTED';
    event: 'NOT_IMPLEMENTED';
    semantic: 'NOT_IMPLEMENTED';
    rrf: 'NOT_IMPLEMENTED';
    non_collapse: 'NOT_IMPLEMENTED';
  };
};
