import { createSearchHandler } from './search-handler.ts';
import { createServerSearchClient } from './server-client.ts';

interface DenoRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare const Deno: DenoRuntime;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const backendKey = Deno.env.get('LEMON_SUPABASE_SECRET_KEY')
  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !backendKey) {
  throw new Error('Search Edge backend configuration is missing.');
}

Deno.serve(createSearchHandler({
  client: createServerSearchClient(supabaseUrl, backendKey),
}));
