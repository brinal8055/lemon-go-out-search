import type { EventCard, UiLocale } from '@lemon/contracts';

const STOCKHOLM_TIMEZONE = 'Europe/Stockholm';

export function formatEventTime(event: Pick<EventCard, 'startsAt' | 'endsAt'>, locale: UiLocale): string {
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-GB';
  const start = new Date(event.startsAt);
  const date = new Intl.DateTimeFormat(intlLocale, {
    timeZone: STOCKHOLM_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = new Intl.DateTimeFormat(intlLocale, {
    timeZone: STOCKHOLM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  });
  const startText = `${date.format(start)} · ${time.format(start)}`;
  if (!event.endsAt) return startText;

  const end = new Date(event.endsAt);
  if (localDateKey(start) === localDateKey(end)) {
    return `${date.format(start)} · ${time.format(start)}–${time.format(end)}`;
  }
  return `${startText} – ${date.format(end)} · ${time.format(end)}`;
}

export function formatEventVenue(
  event: Pick<EventCard, 'venue'>,
  labels: { linkedVenue: string; standaloneVenue: string },
): string {
  if (event.venue.canonicalPlaceId) return `${labels.linkedVenue} ${event.venue.name}`;
  return `${labels.standaloneVenue}: ${event.venue.name}`;
}

function localDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone: STOCKHOLM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
