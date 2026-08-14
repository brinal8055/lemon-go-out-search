export type SearchRpcParams = {
  p_request_id: string;
  p_query: string;
  p_query_norm: string;
  p_query_ascii: string;
  p_ui_locale: 'en' | 'sv';
  p_scope_id: string;
  p_latitude: number | null;
  p_longitude: number | null;
  p_radius_m: number | null;
  p_taxonomy_node_id: string | null;
  p_entity_types: Array<'PLACE' | 'EVENT'> | null;
  p_time_start: string | null;
  p_time_end: string | null;
  p_query_vector: null;
  p_embedding_provider: 'not-configured';
  p_embedding_model: 'not-configured';
  p_embedding_revision: 'not-configured';
  p_embedding_dimension: 1;
  p_limit: number;
  p_search_config_version: 'search-02-deterministic-v1';
};

export type SearchRpcRow = {
  result_position: number;
  entity_id: string;
  entity_type: 'PLACE' | 'EVENT';
  display_name: string;
  categories: unknown;
  latitude: number;
  longitude: number;
  distance_m: number | null;
  factual_summary: string | null;
  place_status: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'UNKNOWN' | null;
  opening_hours: unknown;
  event_starts_at: string | null;
  event_ends_at: string | null;
  event_timezone: string | null;
  event_status: 'SCHEDULED' | null;
  venue: unknown;
  semantic_used: boolean;
  semantic_degraded: boolean;
};

type RpcResult<T> = Promise<{
  data: T | null;
  error: { code?: string; message?: string } | null;
}>;

export type SearchRpcClient = {
  schema(name: 'api'): {
    rpc(name: 'search_v1', params: SearchRpcParams): RpcResult<SearchRpcRow[]>;
  };
};
