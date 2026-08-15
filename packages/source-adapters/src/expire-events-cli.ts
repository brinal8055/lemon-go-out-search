import { fixtureDatabaseUrl, prepareLocalIngestionRuntime } from '@lemon/ingestion-domain';
import { expireEvents } from './expire-events.ts';

try {
  const connectionString = fixtureDatabaseUrl();
  await prepareLocalIngestionRuntime(connectionString);
  console.log(JSON.stringify(await expireEvents(connectionString)));
} catch (error) {
  console.error(JSON.stringify({
    command: 'expire:events',
    error: error instanceof Error ? error.message : 'unknown Event expiry failure',
  }));
  process.exitCode = 1;
}
