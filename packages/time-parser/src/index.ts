export const STOCKHOLM_TIME_ZONE = 'Europe/Stockholm' as const;
export const TIME_PARSER_VERSION = 'time-parser-v1' as const;

export type TimeInterval = {
  start: string;
  end: string;
};

export type TimeParseResult =
  | {
      status: 'PARSED';
      parserVersion: typeof TIME_PARSER_VERSION;
      timeZone: typeof STOCKHOLM_TIME_ZONE;
      matchedExpressions: string[];
      lexicalText: string;
      interval: TimeInterval;
    }
  | {
      status: 'UNSUPPORTED';
      parserVersion: typeof TIME_PARSER_VERSION;
      errorCode: 'UNSUPPORTED_TIME';
    }
  | {
      status: 'AMBIGUOUS';
      parserVersion: typeof TIME_PARSER_VERSION;
      errorCode: 'AMBIGUOUS_TIME';
    };

export type TimeParserOptions = {
  now: Date;
  timeZone: typeof STOCKHOLM_TIME_ZONE;
};

type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number; second: number };
type BoundaryKind = 'EVENING' | 'TOMORROW' | 'WEEKDAY' | 'THIS_WEEKEND' | 'NEXT_WEEKEND';
type Recognition = { text: string; start: number; end: number; kind: BoundaryKind; weekday?: number };

const eveningStartHour = 18;
const eveningEndHour = 2;
const minuteMilliseconds = 60_000;

const weekdayNames = new Map<string, number>([
  ['sunday', 0], ['söndag', 0],
  ['monday', 1], ['måndag', 1],
  ['tuesday', 2], ['tisdag', 2],
  ['wednesday', 3], ['onsdag', 3],
  ['thursday', 4], ['torsdag', 4],
  ['friday', 5], ['fredag', 5],
  ['saturday', 6], ['lördag', 6],
]);

const fixedExpressions: Array<{ text: string; kind: BoundaryKind }> = [
  { text: 'this evening', kind: 'EVENING' },
  { text: 'next weekend', kind: 'NEXT_WEEKEND' },
  { text: 'this weekend', kind: 'THIS_WEEKEND' },
  { text: 'nästa helg', kind: 'NEXT_WEEKEND' },
  { text: 'i helgen', kind: 'THIS_WEEKEND' },
  { text: 'tomorrow', kind: 'TOMORROW' },
  { text: 'imorgon', kind: 'TOMORROW' },
  { text: 'tonight', kind: 'EVENING' },
  { text: 'ikväll', kind: 'EVENING' },
];

export function parseTimeExpression(
  expression: string,
  options: TimeParserOptions,
): TimeParseResult | null {
  if (options.timeZone !== STOCKHOLM_TIME_ZONE) throw new Error('TIME_ZONE_UNSUPPORTED');
  if (!(options.now instanceof Date) || !Number.isFinite(options.now.getTime())) {
    throw new Error('INVALID_INJECTED_CLOCK');
  }

  const normalized = expression.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const recognitions = recognize(normalized);
  if (recognitions.length === 0) {
    return { status: 'UNSUPPORTED', parserVersion: TIME_PARSER_VERSION, errorCode: 'UNSUPPORTED_TIME' };
  }

  const intervals: Array<{ recognition: Recognition; interval: TimeInterval }> = [];
  for (const recognition of recognitions) {
    const interval = resolveInterval(recognition, options.now, options.timeZone);
    if (interval === null) return null;
    intervals.push({ recognition, interval });
  }
  const distinctIntervals = new Set(intervals.map(({ interval }) => `${interval.start}/${interval.end}`));
  if (distinctIntervals.size !== 1) {
    return { status: 'AMBIGUOUS', parserVersion: TIME_PARSER_VERSION, errorCode: 'AMBIGUOUS_TIME' };
  }

  return {
    status: 'PARSED',
    parserVersion: TIME_PARSER_VERSION,
    timeZone: options.timeZone,
    matchedExpressions: [...new Set(recognitions.map(({ text }) => text))].sort(),
    lexicalText: removeRecognitions(normalized, recognitions),
    interval: intervals[0].interval,
  };
}

function removeRecognitions(expression: string, recognitions: Recognition[]): string {
  let result = '';
  let cursor = 0;
  for (const recognition of [...recognitions].sort((left, right) => left.start - right.start)) {
    result += `${expression.slice(cursor, recognition.start)} `;
    cursor = recognition.end;
  }
  return `${result}${expression.slice(cursor)}`.replace(/\s+/g, ' ').trim();
}

function recognize(expression: string): Recognition[] {
  const matches: Recognition[] = [];
  for (const fixed of fixedExpressions) addMatches(matches, expression, fixed.text, fixed.kind);
  for (const [weekday, weekdayNumber] of weekdayNames) {
    addMatches(matches, expression, `this ${weekday}`, 'WEEKDAY', weekdayNumber);
    if (!weekday.endsWith('day')) addMatches(matches, expression, `på ${weekday}`, 'WEEKDAY', weekdayNumber);
    addMatches(matches, expression, weekday, 'WEEKDAY', weekdayNumber);
  }

  matches.sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start));
  const selected: Recognition[] = [];
  for (const match of matches) {
    if (!selected.some((current) => match.start < current.end && match.end > current.start)) {
      selected.push(match);
    }
  }
  return selected;
}

function addMatches(
  matches: Recognition[],
  expression: string,
  phrase: string,
  kind: BoundaryKind,
  weekday?: number,
): void {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
  for (const match of expression.matchAll(pattern)) {
    matches.push({ text: phrase, start: match.index, end: match.index + phrase.length, kind, weekday });
  }
}

function resolveInterval(
  recognition: Recognition,
  now: Date,
  timeZone: typeof STOCKHOLM_TIME_ZONE,
): TimeInterval | null {
  const localNow = instantToLocal(now, timeZone);
  const today = pickDate(localNow);
  let start: Date;
  let end: Date;

  switch (recognition.kind) {
    case 'EVENING': {
      const targetDate = localNow.hour < eveningEndHour ? addDays(today, -1) : today;
      start = localToInstant({ ...targetDate, hour: eveningStartHour, minute: 0, second: 0 }, timeZone, 'start');
      end = localToInstant({ ...addDays(targetDate, 1), hour: eveningEndHour, minute: 0, second: 0 }, timeZone, 'end');
      start = laterInstant(start, now);
      break;
    }
    case 'TOMORROW': {
      const tomorrow = addDays(today, 1);
      start = atStartOfDay(tomorrow, timeZone, 'start');
      end = atStartOfDay(addDays(tomorrow, 1), timeZone, 'end');
      break;
    }
    case 'WEEKDAY': {
      const targetDate = addDays(today, ((recognition.weekday ?? 0) - weekdayOf(today) + 7) % 7);
      start = laterInstant(atStartOfDay(targetDate, timeZone, 'start'), now);
      end = atStartOfDay(addDays(targetDate, 1), timeZone, 'end');
      break;
    }
    case 'THIS_WEEKEND':
    case 'NEXT_WEEKEND': {
      const todayWeekday = weekdayOf(today);
      const nearestSaturdayDelta = todayWeekday === 0 ? -1 : 6 - todayWeekday;
      const extraWeek = recognition.kind === 'NEXT_WEEKEND' ? 7 : 0;
      const saturday = addDays(today, nearestSaturdayDelta + extraWeek);
      start = atStartOfDay(saturday, timeZone, 'start');
      if (recognition.kind === 'THIS_WEEKEND') start = laterInstant(start, now);
      end = atStartOfDay(addDays(saturday, 2), timeZone, 'end');
      break;
    }
  }

  if (start.getTime() >= end.getTime()) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

function atStartOfDay(
  date: LocalDate,
  timeZone: typeof STOCKHOLM_TIME_ZONE,
  boundary: 'start' | 'end',
): Date {
  return localToInstant({ ...date, hour: 0, minute: 0, second: 0 }, timeZone, boundary);
}

function localToInstant(
  local: LocalDateTime,
  timeZone: typeof STOCKHOLM_TIME_ZONE,
  boundary: 'start' | 'end',
): Date {
  const localEpoch = localEpochMilliseconds(local);
  const offsets = new Set<number>();
  for (let delta = -48; delta <= 48; delta += 6) {
    const instant = new Date(localEpoch + delta * 3_600_000);
    offsets.add(localEpochMilliseconds(instantToLocal(instant, timeZone)) - instant.getTime());
  }

  const matches = [...offsets]
    .map((offset) => new Date(localEpoch - offset))
    .filter((instant) => sameLocal(instantToLocal(instant, timeZone), local))
    .sort((left, right) => left.getTime() - right.getTime());
  if (matches.length > 0) return boundary === 'start' ? matches[0] : matches[matches.length - 1];

  for (let instantMs = localEpoch - 18 * 3_600_000; instantMs <= localEpoch + 18 * 3_600_000; instantMs += minuteMilliseconds) {
    const candidate = new Date(instantMs);
    const candidateLocal = instantToLocal(candidate, timeZone);
    if (sameDate(candidateLocal, local) && compareLocal(candidateLocal, local) >= 0) return candidate;
  }
  throw new Error('LOCAL_TIME_UNRESOLVABLE');
}

function instantToLocal(instant: Date, timeZone: typeof STOCKHOLM_TIME_ZONE): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  };
}

function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function localEpochMilliseconds(local: LocalDateTime): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
}

function pickDate(local: LocalDateTime): LocalDate {
  return { year: local.year, month: local.month, day: local.day };
}

function laterInstant(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : new Date(right.getTime());
}

function sameDate(left: LocalDate, right: LocalDate): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function sameLocal(left: LocalDateTime, right: LocalDateTime): boolean {
  return sameDate(left, right)
    && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

function compareLocal(left: LocalDateTime, right: LocalDateTime): number {
  return localEpochMilliseconds(left) - localEpochMilliseconds(right);
}
