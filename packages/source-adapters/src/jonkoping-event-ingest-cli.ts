import { fixtureDatabaseUrl } from '@lemon/ingestion-domain';
import { runJonkopingEventRefresh } from './jonkoping-event-ingestion.ts';

try {
  const report = await runJonkopingEventRefresh(fixtureDatabaseUrl());
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(JSON.stringify({
    source: 'JONKOPING_EVENT_CALENDAR',
    failures: 1,
    error: error instanceof Error ? error.message : 'unknown Event refresh failure',
  }));
  process.exitCode = 1;
}
