import { createSearchClient, createSearchRequest } from '../apps/mobile/src/search.ts';

const edgeUrl = 'http://127.0.0.1:54321/functions/v1/search';
const client = createSearchClient(edgeUrl);
const knownItem = await client(createSearchRequest('Evergreen Restaurang & Pizzeria'));
const place = knownItem.results.find((item) => item.type === 'PLACE' && item.name === 'Evergreen Restaurang & Pizzeria');
if (!place) throw new Error('Evergreen Restaurang & Pizzeria was not returned to the mobile client.');

const english = await client(createSearchRequest('food', 'en'));
if (!english.results.some((item) => item.type === 'PLACE')) throw new Error('English discovery returned no places.');

const swedish = await client(createSearchRequest('restauranger', 'sv'));
if (!swedish.results.some((item) => item.type === 'PLACE')) throw new Error('Swedish discovery returned no places.');

const browse = await client(createSearchRequest('', 'sv', '15904283-fd01-5fc3-ac00-c42e62e8422e'));
if (!browse.results.some((item) => item.type === 'PLACE')) throw new Error('Empty-query taxonomy browse returned no places.');

console.log(`MOB-02 real smoke: PASS (${place.name}; EN=${english.results.length}; SV=${swedish.results.length}; browse=${browse.results.length})`);
