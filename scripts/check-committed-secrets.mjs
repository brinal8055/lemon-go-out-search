import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tracked = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' });
if (tracked.error) throw tracked.error;
if (tracked.status !== 0) process.exit(tracked.status ?? 1);

const forbiddenFiles = /(^|\/)(\.env(?!\.example$)|.*\.(dump|backup|sql\.gz))$/;
const secretAssignment = /^(?:SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|LEMON_SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|VOYAGE_API_KEY)=[ \t]*[^\s#]+/m;
const publicSecretAssignment = /^EXPO_PUBLIC_[A-Z0-9_]*(?:ADMIN|SECRET|SERVICE_ROLE|VOYAGE|DATABASE|DB_PASSWORD|ACCESS_TOKEN)[A-Z0-9_]*=[ \t]*[^\s#]+/m;

for (const file of tracked.stdout.split('\0').filter(Boolean)) {
  if (!existsSync(file)) continue;
  if (forbiddenFiles.test(file)) throw new Error(`tracked private artifact: ${file}`);
  const content = readFileSync(file, 'utf8');
  if (secretAssignment.test(content) || publicSecretAssignment.test(content)) {
    throw new Error(`committed secret-like assignment: ${file}`);
  }
}

console.log('Committed secret scan: PASS');
