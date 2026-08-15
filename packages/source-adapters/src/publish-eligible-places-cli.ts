import { fixtureDatabaseUrl } from '@lemon/ingestion-domain';
import { publishEligiblePlaces } from './publish-eligible-places.ts';

if (process.argv.length !== 2) throw new Error('usage: pnpm coverage:publish');
console.log(JSON.stringify(await publishEligiblePlaces(fixtureDatabaseUrl())));
