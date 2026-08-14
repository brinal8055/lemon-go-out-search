export const NORMALIZATION_VERSION = 'norm-v1';

export type NormalizedSearchText = {
  preserving: string;
  accentless: string;
};

export class InvalidSearchTextError extends Error {
  constructor() {
    super('search text contains a disallowed control character');
    this.name = 'InvalidSearchTextError';
  }
}

const NON_DECOMPOSING_UNACCENT: Readonly<Record<string, string>> = {
  æ: 'ae',
  ð: 'd',
  ø: 'o',
  þ: 'th',
  ł: 'l',
  œ: 'oe',
  ß: 'ss',
};

export function normalizePreserving(value: string): string {
  const disallowedControl = [...value]
    .some((character) => character !== '\t' && character !== '\n' && /\p{Cc}/u.test(character));
  if (disallowedControl) throw new InvalidSearchTextError();

  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim();
}

export function toPostgresCompatibleUnaccent(value: string): string {
  return [...value]
    .map((character) => NON_DECOMPOSING_UNACCENT[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function normalizeForSearch(value: string): NormalizedSearchText {
  const preserving = normalizePreserving(value);
  return {
    preserving,
    accentless: toPostgresCompatibleUnaccent(preserving),
  };
}
