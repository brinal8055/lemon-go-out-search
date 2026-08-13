import { loadTuningJudgments, validateCorpus, validateScaffolds } from '../packages/evaluation/validation/corpus.mjs';

const splitArgument = process.argv.find((argument) => argument.startsWith('--judgments='));
if (splitArgument) await loadTuningJudgments(splitArgument.slice('--judgments='.length));

const { records, checksum, pairGroupCount } = await validateCorpus();
await validateScaffolds();
console.log(`evaluation corpus valid: ${records.length} queries, ${pairGroupCount} EN/SV pairs, sha256 ${checksum}`);
