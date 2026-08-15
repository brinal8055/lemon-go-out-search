import {
  createSearchClient,
  createSearchRequest,
  resolveSearch,
} from '../apps/mobile/src/search.ts';
import { formatEventTime, formatEventVenue } from '../apps/mobile/src/event-presentation.ts';

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

const eventSearch = await client(createSearchRequest('events in Jönköping', 'en'));
const event = eventSearch.results.find((item) => item.type === 'EVENT');
if (!event) throw new Error('Event-producing query returned no Events.');
const eventState = resolveSearch(1, 1, eventSearch);
if (!eventState || eventState.status !== 'results') throw new Error('Event response was not renderable.');
if (eventState.results.map((item) => item.canonicalId).join() !== eventSearch.results.map((item) => item.canonicalId).join()) {
  throw new Error('Mobile changed server result order.');
}
const eventTime = formatEventTime(event, 'en');
const eventVenue = formatEventVenue(event, { linkedVenue: 'At', standaloneVenue: 'Venue' });

const broad = english;
if (broad.results.length === 0) throw new Error('Broad query returned no results.');

console.log(`MOB-03 real smoke: PASS (Place=${place.name}; Event=${event.title}; time=${eventTime}; venue=${eventVenue}; broad=${broad.results.length}; EN=${english.results.length}; SV=${swedish.results.length}; browse=${browse.results.length})`);
