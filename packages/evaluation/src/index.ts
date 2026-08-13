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
};
