interface DenoRuntime {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare const Deno: DenoRuntime;

const headers = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

Deno.serve((request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  return Response.json(
    {
      error: {
        code: 'BOOTSTRAP_ONLY',
        message: 'Search is not implemented yet.',
        retryable: false,
      },
    },
    { status: 501, headers },
  );
});

