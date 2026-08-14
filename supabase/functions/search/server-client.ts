import type { SearchRpcClient, SearchRpcParams, SearchRpcRow } from './types.ts';

type RpcResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export function createServerSearchClient(
  supabaseUrl: string,
  backendKey: string,
  fetchImpl: typeof fetch = fetch,
): SearchRpcClient {
  const baseUrl = supabaseUrl.replace(/\/$/, '');

  return {
    schema(schemaName) {
      if (schemaName !== 'api') throw new Error('Unsupported database schema.');
      return {
        async rpc(functionName, params): Promise<RpcResult<SearchRpcRow[]>> {
          if (functionName !== 'search_v1') throw new Error('Unsupported database function.');
          const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/search_v1`, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'accept-profile': 'api',
              apikey: backendKey,
              authorization: `Bearer ${backendKey}`,
              'content-profile': 'api',
              'content-type': 'application/json',
            },
            body: JSON.stringify(params satisfies SearchRpcParams),
          });
          const payload: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const error = isRecord(payload) ? payload : {};
            return {
              data: null,
              error: {
                code: typeof error.code === 'string' ? error.code : undefined,
                message: typeof error.message === 'string' ? error.message : undefined,
              },
            };
          }
          return {
            data: Array.isArray(payload) ? payload as SearchRpcRow[] : null,
            error: Array.isArray(payload) ? null : { code: 'INVALID_RPC_RESPONSE' },
          };
        },
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
