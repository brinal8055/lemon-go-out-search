import {
  addManualTaxonomyMembership,
  applyTaxonomyMappings,
  fixtureDatabaseUrl,
  prepareLocalTaxonomyRuntime,
  TAXONOMY_VERSION,
} from './index.ts';

const rawArgs = process.argv.slice(2);
const [command, ...args] = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
const options = parseOptions(args);
const connectionString = fixtureDatabaseUrl();
await prepareLocalTaxonomyRuntime(connectionString);

const required = (name: string): string => {
  const value = options.get(name);
  if (!value) throw new Error(`missing --${name}`);
  return value;
};

let output: unknown;
switch (command) {
  case 'apply-mappings':
    output = await applyTaxonomyMappings(connectionString);
    break;
  case 'manual-add':
    output = {
      membershipId: await addManualTaxonomyMembership(connectionString, {
        entityId: required('entity'),
        taxonomyNodeId: required('node'),
        taxonomyVersion: options.get('taxonomy-version') ?? TAXONOMY_VERSION,
        reviewer: required('reviewer'),
        evidence: required('evidence'),
        expectedCurrentMembershipId: options.get('expected-current'),
      }),
    };
    break;
  default:
    throw new Error('usage: taxonomy:apply | taxonomy:manual --entity ID --node ID --reviewer ACTOR --evidence REASON [--expected-current ID]');
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
