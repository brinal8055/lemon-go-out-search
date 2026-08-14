import {
  fixtureDatabaseUrl,
  prepareLocalComplianceRuntime,
  redactSource,
  redactSourceRecordVersion,
  reportSourceRevocation,
} from './index.ts';

const rawArgs = process.argv.slice(2);
const [command, ...args] = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
const options = parseOptions(args);
const databaseUrl = fixtureDatabaseUrl();
await prepareLocalComplianceRuntime(databaseUrl);

const required = (name: string): string => {
  const value = options.get(name);
  if (!value) throw new Error(`missing --${name}`);
  return value;
};
const limit = Number(options.get('limit') ?? 100);

let output: unknown;
switch (command) {
  case 'report':
    output = await reportSourceRevocation(databaseUrl, required('source'), limit);
    break;
  case 'redact-version':
    output = await redactSourceRecordVersion(
      databaseUrl,
      required('version'),
      required('operation'),
      required('reason'),
    );
    break;
  case 'redact-source':
    output = await redactSource(
      databaseUrl,
      required('source'),
      required('operation'),
      required('reason'),
      limit,
    );
    break;
  default:
    throw new Error('usage: provenance:revocation report|redact-version|redact-source [--key value]');
}

console.log(JSON.stringify(output, null, 2));

function parseOptions(values: string[]): Map<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('options must use --key value');
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}
