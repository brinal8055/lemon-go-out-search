import {
  fixtureDatabaseUrl,
  publishFirstPlace,
} from './index.ts';

try {
  const report = await publishFirstPlace(fixtureDatabaseUrl());
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'first Place publication failed');
  process.exitCode = 1;
}
