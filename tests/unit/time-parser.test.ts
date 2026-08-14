import { describe, expect, it } from 'vitest';

import {
  parseTimeExpression,
  STOCKHOLM_TIME_ZONE,
  type TimeInterval,
} from '../../packages/time-parser/src/index.ts';

const mondayNoon = new Date('2026-08-10T10:00:00.000Z');

function interval(expression: string, now = mondayNoon): TimeInterval {
  const result = parseTimeExpression(expression, { now, timeZone: STOCKHOLM_TIME_ZONE });
  expect(result?.status).toBe('PARSED');
  if (result?.status !== 'PARSED') throw new Error(`expected ${expression} to parse`);
  return result.interval;
}

describe('TIME-01 deterministic EN/SV parser', () => {
  it.each(['tonight', 'this evening', 'ikväll'])('%s uses the frozen evening window', (expression) => {
    expect(interval(expression)).toEqual({
      start: '2026-08-10T16:00:00.000Z',
      end: '2026-08-11T00:00:00.000Z',
    });
  });

  it.each(['tomorrow', 'imorgon'])('%s uses the next Stockholm calendar day', (expression) => {
    expect(interval(expression)).toEqual({
      start: '2026-08-10T22:00:00.000Z',
      end: '2026-08-11T22:00:00.000Z',
    });
  });

  it('supports every bare English and Swedish weekday without host-locale parsing', () => {
    const english = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const swedish = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
    for (const expression of [...english, ...swedish]) {
      expect(interval(expression).start).toMatch(/^2026-08-/);
    }
    expect(interval('monday').start).toBe(mondayNoon.toISOString());
    expect(interval('friday')).toEqual({
      start: '2026-08-13T22:00:00.000Z',
      end: '2026-08-14T22:00:00.000Z',
    });
  });

  it('supports explicit this/på weekday forms with the same next-occurrence rule', () => {
    expect(interval('this Friday')).toEqual(interval('Friday'));
    expect(interval('på fredag')).toEqual(interval('fredag'));
    expect(interval('this Monday').start).toBe(mondayNoon.toISOString());
    expect(interval('på måndag').start).toBe(mondayNoon.toISOString());
  });

  it.each(['this weekend', 'i helgen'])('%s selects the nearest unfinished weekend', (expression) => {
    expect(interval(expression)).toEqual({
      start: '2026-08-14T22:00:00.000Z',
      end: '2026-08-16T22:00:00.000Z',
    });
    expect(interval(expression, new Date('2026-08-16T09:00:00.000Z'))).toEqual({
      start: '2026-08-16T09:00:00.000Z',
      end: '2026-08-16T22:00:00.000Z',
    });
  });

  it.each(['next weekend', 'nästa helg'])('%s selects the following ISO-week weekend', (expression) => {
    expect(interval(expression)).toEqual({
      start: '2026-08-21T22:00:00.000Z',
      end: '2026-08-23T22:00:00.000Z',
    });
  });

  it('clamps evening and weekday starts at exact and neighboring boundaries', () => {
    expect(interval('tonight', new Date('2026-08-10T16:00:00.000Z')).start)
      .toBe('2026-08-10T16:00:00.000Z');
    expect(interval('ikväll', new Date('2026-08-10T23:59:59.000Z'))).toEqual({
      start: '2026-08-10T23:59:59.000Z',
      end: '2026-08-11T00:00:00.000Z',
    });
    expect(interval('tonight', new Date('2026-08-11T00:00:00.000Z')).start)
      .toBe('2026-08-11T16:00:00.000Z');
    expect(interval('tonight', new Date('2026-08-11T00:00:01.000Z')).start)
      .toBe('2026-08-11T16:00:00.000Z');
    expect(interval('friday', new Date('2026-08-14T08:00:00.000Z'))).toEqual({
      start: '2026-08-14T08:00:00.000Z',
      end: '2026-08-14T22:00:00.000Z',
    });
    expect(interval('på fredag', new Date('2026-08-14T21:30:00.000Z')).start)
      .toBe('2026-08-14T21:30:00.000Z');
  });

  it('handles month and year rollover with local calendar arithmetic', () => {
    expect(interval('tomorrow', new Date('2026-12-31T11:00:00.000Z'))).toEqual({
      start: '2026-12-31T23:00:00.000Z',
      end: '2027-01-01T23:00:00.000Z',
    });
  });

  it('uses 23-hour and 25-hour tomorrow intervals across Stockholm DST', () => {
    const spring = interval('tomorrow', new Date('2026-03-28T11:00:00.000Z'));
    const fall = interval('imorgon', new Date('2026-10-24T10:00:00.000Z'));
    expect(Date.parse(spring.end) - Date.parse(spring.start)).toBe(23 * 3_600_000);
    expect(Date.parse(fall.end) - Date.parse(fall.start)).toBe(25 * 3_600_000);
  });

  it('uses local weekend boundaries across both Stockholm DST transitions', () => {
    const spring = interval('this weekend', new Date('2026-03-27T11:00:00.000Z'));
    const fall = interval('i helgen', new Date('2026-10-23T10:00:00.000Z'));
    expect(Date.parse(spring.end) - Date.parse(spring.start)).toBe(47 * 3_600_000);
    expect(Date.parse(fall.end) - Date.parse(fall.start)).toBe(49 * 3_600_000);
  });

  it('advances DST gaps and covers both offsets in repeated end times', () => {
    expect(interval('tonight', new Date('2026-03-28T18:00:00.000Z'))).toEqual({
      start: '2026-03-28T18:00:00.000Z',
      end: '2026-03-29T01:00:00.000Z',
    });
    expect(interval('tonight', new Date('2026-10-24T17:00:00.000Z'))).toEqual({
      start: '2026-10-24T17:00:00.000Z',
      end: '2026-10-25T01:00:00.000Z',
    });
  });

  it('returns explicit conservative unsupported and ambiguity results', () => {
    expect(parseTimeExpression('sometime soon', { now: mondayNoon, timeZone: STOCKHOLM_TIME_ZONE }))
      .toEqual({ status: 'UNSUPPORTED', parserVersion: 'time-parser-v1', errorCode: 'UNSUPPORTED_TIME' });
    expect(parseTimeExpression('tomorrow next weekend', { now: mondayNoon, timeZone: STOCKHOLM_TIME_ZONE }))
      .toEqual({ status: 'AMBIGUOUS', parserVersion: 'time-parser-v1', errorCode: 'AMBIGUOUS_TIME' });
  });

  it('represents intervals as half-open at the exact end instant', () => {
    const parsed = interval('tonight');
    const contains = (instant: number) => (
      instant >= Date.parse(parsed.start) && instant < Date.parse(parsed.end)
    );
    const justBeforeEnd = Date.parse(parsed.end) - 1;
    expect(contains(justBeforeEnd)).toBe(true);
    expect(contains(Date.parse(parsed.end))).toBe(false);
  });

  it('is byte-deterministic and independent of the machine timezone', () => {
    const previousTimeZone = process.env.TZ;
    const first = parseTimeExpression('Pizza this Friday', { now: mondayNoon, timeZone: STOCKHOLM_TIME_ZONE });
    process.env.TZ = 'Pacific/Honolulu';
    try {
      const second = parseTimeExpression('Pizza this Friday', { now: mondayNoon, timeZone: STOCKHOLM_TIME_ZONE });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimeZone;
    }
  });

  it('rejects a non-frozen timezone and an invalid injected clock', () => {
    expect(() => parseTimeExpression('tomorrow', {
      now: mondayNoon,
      timeZone: 'UTC' as typeof STOCKHOLM_TIME_ZONE,
    })).toThrow('TIME_ZONE_UNSUPPORTED');
    expect(() => parseTimeExpression('tomorrow', {
      now: new Date(Number.NaN),
      timeZone: STOCKHOLM_TIME_ZONE,
    })).toThrow('INVALID_INJECTED_CLOCK');
  });
});
