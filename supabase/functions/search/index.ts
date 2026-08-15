import { createSearchHandler } from './search-handler.ts';
import { createServerSearchClient } from './server-client.ts';
import { requestVoyageEmbedding } from '../../../packages/embedding/src/voyage-client.ts';

interface DenoRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare const Deno: DenoRuntime;

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('LEMON_SUPABASE_URL');
const backendKey = Deno.env.get('LEMON_SUPABASE_SECRET_KEY')
  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const voyageApiKey = Deno.env.get('VOYAGE_API_KEY');

if (!supabaseUrl) throw new Error('Search Edge backend URL is missing.');
if (!backendKey) throw new Error('Search Edge backend credential is missing.');

Deno.serve(createSearchHandler({
  client: createServerSearchClient(supabaseUrl, backendKey),
  queryEmbedder: voyageApiKey
    ? (input, timeoutMs) => requestVoyageEmbedding(input, 'query', voyageApiKey, { timeoutMs })
    : undefined,
  telemetry: (event) => console.log(JSON.stringify({ event: 'search_request', ...event })),
}));
