import { normalizeForEdgeSearch } from './normalization.ts';

export const SEMANTIC_TAXONOMY_VERSION = 'active-going-out.v1';
export const SEMANTIC_TAXONOMY_CHECKSUM = 'ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2';

type TaxonomyEntry = { id: string; en: string; sv: string; terms: string[] };
export type TaxonomyRecognition = TaxonomyEntry & { matchedTerm: string };

const ACTIVE_TAXONOMY: TaxonomyEntry[] = [
  { id: '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1', en: 'Food & Dining', sv: 'Mat och restauranger', terms: ['Food & Dining', 'Mat och restauranger'] },
  { id: '15904283-fd01-5fc3-ac00-c42e62e8422e', en: 'Dining', sv: 'Restauranger', terms: ['Dining', 'Restauranger'] },
  { id: 'a1c93f96-63bb-5f5b-b929-bac7b2f133dd', en: 'American', sv: 'Amerikansk', terms: ['American', 'Amerikansk'] },
  { id: '6ab01ce5-750f-51f3-b0a5-39b3398c66cd', en: 'Mexican', sv: 'Mexikansk', terms: ['Mexican', 'Mexikansk'] },
  { id: 'd43e33db-0ad3-575c-8514-d01ccf700587', en: 'Italian', sv: 'Italiensk', terms: ['Italian', 'Italiensk'] },
  { id: '3a51d1cf-31c9-529f-b585-1102253dc735', en: 'Japanese', sv: 'Japansk', terms: ['Japanese', 'Japansk'] },
  { id: 'a4e93169-34db-52d0-a474-f42045679a81', en: 'Chinese', sv: 'Kinesisk', terms: ['Chinese', 'Kinesisk'] },
  { id: 'de848fba-6b54-551a-9fcb-e3b3c25b1d3b', en: 'Thai', sv: 'Thailändsk', terms: ['Thai', 'Thailändsk'] },
  { id: '493d4231-5caf-5300-a489-bdc6cf98de6c', en: 'Indian', sv: 'Indisk', terms: ['Indian', 'Indisk'] },
  { id: '18a33f0c-8408-59ce-9927-cceae1a4e4c1', en: 'Greek', sv: 'Grekisk', terms: ['Greek', 'Grekisk'] },
  { id: '65c34f92-d992-50e7-aff2-f31fd1871345', en: 'African', sv: 'Afrikansk', terms: ['African', 'Afrikansk'] },
  { id: '3ae33c42-f401-5989-be69-5ab9223aded2', en: 'Seafood', sv: 'Fisk och skaldjur', terms: ['Seafood', 'Fisk och skaldjur'] },
  { id: 'dcdb5cb7-4ebf-5b55-a867-f1f86b164c8c', en: 'Steakhouse', sv: 'Steakhouse', terms: ['Steakhouse'] },
  { id: 'f2acebc7-8b7e-5c22-9bb5-36a0e29ba4b8', en: 'Vegan/Vegetarian', sv: 'Vegansk/vegetarisk', terms: ['Vegan/Vegetarian', 'Vegansk/vegetarisk'] },
  { id: 'a7d01142-e735-51c9-bf56-b20250c527f1', en: 'Cuban', sv: 'Kubansk', terms: ['Cuban', 'Kubansk'] },
  { id: '3e7336f3-5dbc-51d8-884e-e677e7e1108c', en: 'French', sv: 'Fransk', terms: ['French', 'Fransk'] },
  { id: '27693ef7-a722-551d-ac89-bb8a7b1d5c97', en: 'Spanish', sv: 'Spansk', terms: ['Spanish', 'Spansk'] },
  { id: '3dd38a02-124b-5b4e-aa96-3566ed575340', en: 'Mediterranean', sv: 'Medelhavsk', terms: ['Mediterranean', 'Medelhavsk'] },
  { id: '12aab5bf-b624-5e76-b306-38cf4daa8ea3', en: 'Casual', sv: 'Avslappnad mat', terms: ['Casual', 'Avslappnad mat'] },
  { id: 'acda530f-d654-5027-97b8-a5a912e4b752', en: 'Burgers', sv: 'Burgare', terms: ['Burgers', 'Burgare'] },
  { id: '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc', en: 'Pizza', sv: 'Pizza', terms: ['Pizza'] },
  { id: 'f734c4f1-8cfa-5a5a-b4ee-4e65022cf21b', en: 'Tacos', sv: 'Tacos', terms: ['Tacos'] },
  { id: '6aea79ed-2599-5748-b2fe-a78e1aaeb78d', en: 'Sushi', sv: 'Sushi', terms: ['Sushi'] },
  { id: '5a61890b-e633-5ea0-93eb-f1a18863f0cd', en: 'Poke', sv: 'Poke', terms: ['Poke'] },
  { id: '4516fcf5-4c53-5f7e-8d47-bbd7a93542bf', en: 'Chicken', sv: 'Kyckling', terms: ['Chicken', 'Kyckling'] },
  { id: 'b48854d0-1ed6-5e1b-a101-83f74ad048c1', en: 'Sandwiches', sv: 'Smörgåsar', terms: ['Sandwiches', 'Smörgåsar'] },
  { id: '6ab10ddc-f9ef-5743-b44f-433d2d4884bf', en: 'Food Truck', sv: 'Matvagn', terms: ['Food Truck', 'Matvagn'] },
  { id: 'c519a006-ea39-509b-bde4-8dd92cf9505a', en: 'Bowls', sv: 'Bowls', terms: ['Bowls'] },
  { id: '89cc433a-423a-5eba-9d6a-17c9745d66d8', en: 'Cafés', sv: 'Kaféer', terms: ['Cafés', 'Kaféer'] },
  { id: '92167dc5-bf32-5014-9d07-46f7c4f902dd', en: 'Coffee Shop', sv: 'Kaffebar', terms: ['Coffee Shop', 'Kaffebar'] },
  { id: '8187ab7f-f040-5594-9a14-b01871086788', en: 'Tea House', sv: 'Tehus', terms: ['Tea House', 'Tehus'] },
  { id: '9bd7d2c9-205f-5bc3-8321-ab9c63a14294', en: 'Bubble Tea', sv: 'Bubble tea', terms: ['Bubble Tea', 'Bubble tea'] },
  { id: '9d3578bc-0108-5a05-90f0-ef1b717013c4', en: 'Dessert Café', sv: 'Dessertkafé', terms: ['Dessert Café', 'Dessertkafé'] },
  { id: 'b4176896-4ce9-5815-a445-30a1bd3272e9', en: 'Bakeries', sv: 'Bagerier', terms: ['Bakeries', 'Bagerier'] },
  { id: 'dc6dafd8-bb60-5989-a4f4-2b2ba86329ef', en: 'Desserts', sv: 'Desserter', terms: ['Desserts', 'Desserter'] },
  { id: 'fa1b8735-3c31-5c2c-9762-036a4c74fa06', en: 'Brunch', sv: 'Brunch', terms: ['Brunch'] },
  { id: '2a046d43-20d8-5bb1-9378-e0f66c7d86c1', en: 'Drinks & Nightlife', sv: 'Dryck och nattliv', terms: ['Drinks & Nightlife', 'Dryck och nattliv'] },
  { id: '14257b1c-8bed-5909-97c1-8f2fc6936135', en: 'Bars', sv: 'Barer', terms: ['Bars', 'Barer'] },
  { id: '687fb02d-72a2-55a7-af0f-aea3b992aff3', en: 'Cocktails', sv: 'Cocktails', terms: ['Cocktails'] },
  { id: 'd5056f41-1b30-5f6f-8eb0-d65cac76f86b', en: 'Wine', sv: 'Vin', terms: ['Wine', 'Vin'] },
  { id: '1a48f9c0-9247-554e-9fcf-07ea8707c8cd', en: 'Breweries', sv: 'Bryggerier', terms: ['Breweries', 'Bryggerier'] },
  { id: '20c64458-9996-56ad-a8a6-0cad74c82506', en: 'Nightlife', sv: 'Nattliv', terms: ['Nightlife', 'Nattliv'] },
  { id: '3751ea70-17c8-5ef0-ae44-d9dea192d29f', en: 'Activities & Experiences', sv: 'Aktiviteter och upplevelser', terms: ['Activities & Experiences', 'Aktiviteter och upplevelser'] },
  { id: 'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f', en: 'Sports', sv: 'Sport', terms: ['Sports', 'Sport'] },
  { id: 'e0aa09ec-717d-5e2e-8552-4dd33ba5b5fe', en: 'Games', sv: 'Spel', terms: ['Games', 'Spel'] },
  { id: '90f47852-7a14-50d0-a8d0-a9440b62fee0', en: 'Tours', sv: 'Turer', terms: ['Tours', 'Turer'] },
  { id: '6432bde9-17e2-5a04-92b3-9bf6f4589cf2', en: 'Culture', sv: 'Kultur', terms: ['Culture', 'Kultur'] },
  { id: 'e1a9cc86-214f-5967-b0a5-6925694b01d5', en: 'Events', sv: 'Evenemang', terms: ['Events', 'Evenemang'] },
  { id: '231bbce4-ee4e-552e-a34c-d5a08f0debb1', en: 'Classes', sv: 'Kurser', terms: ['Classes', 'Kurser'] },
  { id: 'f5978b3b-3c95-52fe-8c9c-bf5b6fae9d77', en: 'Nature & Public Places', sv: 'Natur och offentliga platser', terms: ['Nature & Public Places', 'Natur och offentliga platser'] },
  { id: '4b839f2a-5da8-5aff-b66b-2c34e9715b26', en: 'Attractions', sv: 'Sevärdheter', terms: ['Attractions', 'Sevärdheter'] },
  { id: '445e443a-1dcc-5479-8da2-fddaa1032c50', en: 'Malls & Shopping Centers', sv: 'Köpcentrum', terms: ['Malls & Shopping Centers', 'Köpcentrum'] },
];

const GENERIC_NOUNS = new Set([
  'activity', 'activities', 'aktivitet', 'aktiviteter', 'event', 'events', 'evenemang',
  'place', 'places', 'restaurant', 'restaurants', 'restaurang', 'restauranger', 'ställe', 'ställen',
]);
const BY_ID = new Map(ACTIVE_TAXONOMY.map((entry) => [entry.id, entry]));
const BY_TERM = buildTermMap();

export function recognizeTaxonomyQuery(normalizedQuery: string): TaxonomyRecognition | null {
  const direct = uniqueTerm(normalizedQuery);
  if (direct) return { ...direct, matchedTerm: normalizedQuery };
  const tokens = normalizedQuery.split(' ');
  if (tokens.length < 2 || !GENERIC_NOUNS.has(tokens.at(-1) ?? '')) return null;
  const term = tokens.slice(0, -1).join(' ');
  const recognized = uniqueTerm(term);
  return recognized ? { ...recognized, matchedTerm: term } : null;
}

export function taxonomyContextById(id: string | undefined): TaxonomyEntry | null {
  return id ? BY_ID.get(id) ?? null : null;
}

function buildTermMap(): Map<string, TaxonomyEntry | null> {
  const values = new Map<string, TaxonomyEntry | null>();
  for (const entry of ACTIVE_TAXONOMY) {
    for (const term of entry.terms) {
      const normalized = normalizeForEdgeSearch(term).preserving;
      values.set(normalized, values.has(normalized) ? null : entry);
    }
  }
  return values;
}

function uniqueTerm(term: string): TaxonomyEntry | null {
  return BY_TERM.get(term) ?? null;
}
