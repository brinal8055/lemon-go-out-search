import { createSearchClient, createSearchRequest } from '../apps/mobile/src/search.ts';

const edgeUrl = 'http://127.0.0.1:54321/functions/v1/search';
const result = await createSearchClient(edgeUrl)(createSearchRequest('Evergreen Restaurang & Pizzeria'));
const place = result.results.find((item) => item.type === 'PLACE' && item.name === 'Evergreen Restaurang & Pizzeria');
if (!place) throw new Error('Evergreen Restaurang & Pizzeria was not returned to the mobile client.');

console.log(`MOB-01 real smoke: PASS (${place.name})`);
