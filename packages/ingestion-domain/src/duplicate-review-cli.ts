import {
  createDuplicateCandidate,
  decideSameTypeA,
  decideSameTypeB,
  decideSeparate,
  decideUnsure,
  fixtureDatabaseUrl,
  generateDuplicateCandidates,
  listDuplicateCandidates,
  prepareLocalDuplicateReviewRuntime,
  reopenDuplicateCandidate,
  reverseDuplicateSame,
  showDuplicateCandidate,
} from './index.ts';

const [command, ...args] = process.argv.slice(2);
const options = parseOptions(args);
const databaseUrl = fixtureDatabaseUrl();
await prepareLocalDuplicateReviewRuntime(databaseUrl);

const value = (name: string): string => {
  const result = options.get(name);
  if (!result) throw new Error(`missing --${name}`);
  return result;
};
const optional = (name: string): string | null => options.get(name) ?? null;

let output: unknown;
switch (command) {
  case 'list':
    output = await listDuplicateCandidates(databaseUrl, Number(options.get('limit') ?? 50));
    break;
  case 'show':
    output = await showDuplicateCandidate(databaseUrl, value('candidate'));
    break;
  case 'generate':
    output = await generateDuplicateCandidates(databaseUrl, Number(options.get('limit') ?? 50));
    break;
  case 'create':
    output = { candidateId: await createDuplicateCandidate(databaseUrl, value('record-a'), value('record-b'), value('reviewer')) };
    break;
  case 'refresh':
    output = { decisionId: await reopenDuplicateCandidate(databaseUrl, value('candidate'), value('expected'), value('reviewer'), optional('note')) };
    break;
  case 'same-type-a':
    output = { decisionId: await decideSameTypeA(databaseUrl, value('candidate'), value('expected'), value('record'), value('target'), value('reviewer'), optional('note')) };
    break;
  case 'same-type-b':
    output = { decisionId: await decideSameTypeB(databaseUrl, value('candidate'), value('expected'), value('survivor'), value('reviewer'), optional('note')) };
    break;
  case 'separate':
    output = { decisionId: await decideSeparate(databaseUrl, value('candidate'), value('expected'), value('reviewer'), optional('note')) };
    break;
  case 'unsure':
    output = { decisionId: await decideUnsure(databaseUrl, value('candidate'), value('expected'), value('reviewer'), optional('note')) };
    break;
  case 'reverse':
    output = { decisionId: await reverseDuplicateSame(databaseUrl, value('candidate'), value('expected'), value('reviewer'), optional('note')) };
    break;
  default:
    throw new Error('usage: dedup:review list|show|generate|create|refresh|same-type-a|same-type-b|separate|unsure|reverse [--key value]');
}

console.log(JSON.stringify(output, null, 2));

function parseOptions(values: string[]): Map<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const optionValue = values[index + 1];
    if (!key?.startsWith('--') || optionValue === undefined) throw new Error('options must use --key value');
    parsed.set(key.slice(2), optionValue);
  }
  return parsed;
}
