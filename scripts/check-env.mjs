const targetVariables = {
  mobile: ['EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL'],
  edge: [
    'SUPABASE_URL',
    'LEMON_SUPABASE_SECRET_KEY',
    'LEMON_EMBEDDING_API_KEY',
  ],
  deploy: [
    'EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL',
    'SUPABASE_URL',
    'LEMON_SUPABASE_SECRET_KEY',
    'LEMON_EMBEDDING_API_KEY',
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_PROJECT_ID',
  ],
};

export function validateEnvironment(target, environment) {
  const required = targetVariables[target];

  if (!required) {
    return {
      ok: false,
      message: `Unknown environment target: ${target}`,
    };
  }

  const missing = required.filter((name) => !environment[name]?.trim());

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing ${target} environment variables: ${missing.join(', ')}`,
    };
  }

  return {
    ok: true,
    message: `${target} environment is configured (${required.length} variables).`,
  };
}

function parseTarget(args) {
  const targetIndex = args.indexOf('--target');
  return targetIndex === -1 ? 'mobile' : args[targetIndex + 1];
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = validateEnvironment(parseTarget(process.argv.slice(2)), process.env);
  const output = result.ok ? console.log : console.error;
  output(result.message);
  process.exitCode = result.ok ? 0 : 1;
}

