const NON_DECOMPOSING_UNACCENT: Readonly<Record<string, string>> = {
  æ: 'ae',
  ð: 'd',
  ø: 'o',
  þ: 'th',
  ł: 'l',
  œ: 'oe',
  ß: 'ss',
};

export function normalizeForEdgeSearch(value: string): { preserving: string; accentless: string } {
  const disallowedControl = [...value]
    .some((character) => character !== '\t' && character !== '\n' && /\p{Cc}/u.test(character));
  if (disallowedControl) throw new Error('search text contains a disallowed control character');

  const preserving = value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim();
  const accentless = [...preserving]
    .map((character) => NON_DECOMPOSING_UNACCENT[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();

  return { preserving, accentless };
}
