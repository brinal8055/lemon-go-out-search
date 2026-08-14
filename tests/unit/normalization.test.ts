import { describe, expect, it } from 'vitest';
import {
  InvalidSearchTextError,
  normalizeForSearch,
} from '../../packages/normalization/src/index.ts';
import { fixtureDatabaseUrl } from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';

const goldenCases = [
  ['  Café   Väster  ', 'café väster', 'cafe vaster'],
  ["O'Learys–Jönköping", 'o learys jönköping', 'o learys jonkoping'],
  ['BADA  BING!', 'bada bing', 'bada bing'],
  ['ÅÄÖ', 'åäö', 'aao'],
  ['Cafe\u0301', 'café', 'cafe'],
  ['STUK-Café', 'stuk café', 'stuk cafe'],
  ['  Food & Dining / Bar  ', 'food dining bar', 'food dining bar'],
  ['Rad\tEtt\nRad Två', 'rad ett rad två', 'rad ett rad tva'],
  ['\u00a0Jönköping\u00a0', 'jönköping', 'jonkoping'],
  [
    'Evergreen Restaurang & Pizzeria',
    'evergreen restaurang pizzeria',
    'evergreen restaurang pizzeria',
  ],
] as const;

describe('norm-v1', () => {
  it.each(goldenCases)(
    'matches SQL for %j',
    async (input, expectedPreserving, expectedAccentless) => {
      const typescript = normalizeForSearch(input);
      const [sql] = await fixtureQuery<{ preserving: string; accentless: string }>(
        fixtureDatabaseUrl(),
        `select app.norm_v1_preserving($1) as preserving,
                app.norm_v1_accentless($1) as accentless`,
        [input],
      );

      expect(typescript).toEqual({
        preserving: expectedPreserving,
        accentless: expectedAccentless,
      });
      expect(sql).toEqual(typescript);
    },
  );

  it('preserves the original display string separately', () => {
    const display = "O'Learys–Jönköping";
    normalizeForSearch(display);
    expect(display).toBe("O'Learys–Jönköping");
  });

  it('keeps accentless output separate from protected preserving output', () => {
    expect(normalizeForSearch('Jönköping')).toEqual({
      preserving: 'jönköping',
      accentless: 'jonkoping',
    });
  });

  it('rejects disallowed controls in TypeScript and SQL', async () => {
    expect(() => normalizeForSearch('bad\rtext')).toThrow(InvalidSearchTextError);
    await expect(fixtureQuery(
      fixtureDatabaseUrl(),
      'select app.norm_v1_preserving($1)',
      ['bad\rtext'],
    )).rejects.toMatchObject({ code: '22021' });
  });
});
