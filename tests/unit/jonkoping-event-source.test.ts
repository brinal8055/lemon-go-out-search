import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  absenceHasMeaning,
  classifyEventDetail,
  compareRepeatedProbe,
  EventSourceProbeError,
  JONKOPING_EVENT_REFRESH_MODE,
  JonkopingEventProbe,
  type EventProbeResult,
  type PermittedEventOccurrence,
} from '../../packages/source-adapters/src/jonkoping-events.ts';

const eventUuid = '6059d02e-9697-41fb-82d8-f8a868b9978b';
const startMs = Date.parse('2026-08-20T18:00:00+02:00');
const endMs = Date.parse('2026-08-20T20:00:00+02:00');
const hit = {
  id: '5.source-page-id',
  title: 'Bounded Event',
  url: 'https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-08-20-bounded-event',
  structuredStartDate: '2026-08-20T18:00:00+02:00',
  structuredEndDate: '2026-08-20T20:00:00+02:00',
  location: 'Rådhusparken, Jönköping',
  locationCoordinates: '57.7814, 14.1618',
  categories: ['Musik', 'Festival', 'Musik'],
};

function detail(starts: number[], ends: Array<number | null> = []): string {
  const query = new URLSearchParams({
    'event.id': eventUuid,
    'event.name': 'Bounded Event',
    'event.placeName': 'Rådhusparken',
    'event.city': 'Jönköping',
    'event.street': 'Rådhusparken 1',
    'date.startDates': starts.join(','),
    'date.endDates': ends.map((value) => value === null ? '' : String(value)).join(','),
    'event.desc': 'must never be retained',
    'event.text': 'must never be retained',
    'organizer.email': 'must-never-be-retained@example.invalid',
    'applier.name': 'must never be retained',
    'event.imageUrl': 'https://example.invalid/prohibited.jpg',
  });
  return `<p class="normal">https://www.jonkoping.se/evenemangskalender/skapa-evenemang?${query.toString().replaceAll('&', '&amp;')}</p>`;
}

function searchResponse(hits: typeof hit[]): Response {
  return new Response(JSON.stringify({
    searchHits: hits,
    searchInfo: { totalPages: 1, currentPage: 1 },
  }));
}

function result(events: PermittedEventOccurrence[]): EventProbeResult {
  return {
    sourceKey: 'JONKOPING_EVENT_CALENDAR',
    refreshMode: 'DELTA_ONLY',
    searchRequests: 1,
    detailRequests: events.length,
    fetchedHits: events.length,
    outsideHorizon: 0,
    invalid: 0,
    multiOccurrenceSkipped: 0,
    accepted: events,
  };
}

describe('SRC-03A bounded Jönköping Event source', () => {
  it('accepts exactly one schedule and derives identity only from the stable Event UUID', () => {
    const classified = classifyEventDetail(hit, detail([startMs], [endMs]));
    expect(classified).toMatchObject({
      classification: 'ACCEPTED_SINGLE_OCCURRENCE',
      sourceEventUuid: eventUuid,
      occurrenceCount: 1,
    });
    expect(classified.event).toEqual({
      sourceEventUuid: eventUuid,
      externalKey: `event/${eventUuid}`,
      title: 'Bounded Event',
      start: '2026-08-20T16:00:00.000Z',
      end: '2026-08-20T18:00:00.000Z',
      timeZone: 'Europe/Stockholm',
      venueName: 'Rådhusparken',
      city: 'Jönköping',
      address: 'Rådhusparken 1',
      latitude: 57.7814,
      longitude: 14.1618,
      categories: ['Festival', 'Musik'],
      sourceUrl: hit.url,
      status: null,
    });
    expect(Object.keys(classified.event ?? {})).not.toContain('description');
    expect(JSON.stringify(classified.event)).not.toContain('must never be retained');
  });

  it('keeps identity stable when the source schedule changes', () => {
    const first = classifyEventDetail(hit, detail([startMs], [endMs])).event;
    const movedHit = {
      ...hit,
      structuredStartDate: '2026-08-21T18:00:00+02:00',
      structuredEndDate: '2026-08-21T20:00:00+02:00',
    };
    const moved = classifyEventDetail(
      movedHit,
      detail([startMs + 86_400_000], [endMs + 86_400_000]),
    ).event;
    expect(moved?.externalKey).toBe(first?.externalKey);
    expect(moved?.start).not.toBe(first?.start);
  });

  it('rejects multi-occurrence identity without ordinal, date, hash, or generated fallback', () => {
    const classified = classifyEventDetail(hit, detail([startMs, startMs + 86_400_000], [endMs, endMs + 86_400_000]));
    expect(classified).toEqual({
      classification: 'UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY',
      sourceEventUuid: eventUuid,
      occurrenceCount: 2,
      event: null,
    });
    expect(JSON.stringify(classified)).not.toContain(String(startMs));
    expect(JSON.stringify(classified)).not.toContain('/occurrence/');
  });

  it('fails closed when a previously single Event becomes multi-occurrence', () => {
    const classified = classifyEventDetail(
      hit,
      detail([startMs, startMs + 86_400_000], [endMs, endMs + 86_400_000]),
      true,
    );
    expect(classified).toMatchObject({ classification: 'IDENTITY_BECAME_AMBIGUOUS', event: null });
  });

  it('compares repeats by stable key independently of result ordering and schedule changes', () => {
    const firstEvent = classifyEventDetail(hit, detail([startMs], [endMs])).event!;
    const other = { ...firstEvent, sourceEventUuid: '109670c8-e5eb-4186-a4e0-5c8cc8d5ae9e', externalKey: 'event/109670c8-e5eb-4186-a4e0-5c8cc8d5ae9e' };
    const moved = { ...firstEvent, start: '2026-08-21T16:00:00.000Z' };
    expect(compareRepeatedProbe(result([firstEvent, other]), result([other, moved]))).toEqual({
      repeatedExternalKeys: [firstEvent.externalKey, other.externalKey].sort(),
      scheduleChanges: 1,
    });
  });

  it('uses bounded search/detail requests with timeout and response-size guards', async () => {
    const secondHit = { ...hit, id: '5.second', url: `${hit.url}-second`, title: 'Second Event' };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      if (url.includes('sv.target=')) return searchResponse([hit, secondHit]);
      return new Response(detail([startMs], [endMs]));
    });
    const probe = new JonkopingEventProbe({
      fetchImpl: fetchMock as typeof fetch,
      now: () => new Date('2026-08-15T00:00:00Z'),
    });
    const fetched = await probe.fetch(new AbortController().signal);
    expect(fetched).toMatchObject({ searchRequests: 1, detailRequests: 2, fetchedHits: 2 });
    expect(fetched.accepted).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const timedOut = new JonkopingEventProbe({
      fetchImpl: (async () => { throw new DOMException('timeout', 'TimeoutError'); }) as typeof fetch,
    });
    await expect(timedOut.fetch(new AbortController().signal)).rejects.toMatchObject({ code: 'TIMEOUT' });

    const oversized = new JonkopingEventProbe({
      fetchImpl: (async () => new Response('', { headers: { 'content-length': '524289' } })) as typeof fetch,
    });
    await expect(oversized.fetch(new AbortController().signal)).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('records DELTA_ONLY absence semantics and a disabled production source contract', async () => {
    expect(JONKOPING_EVENT_REFRESH_MODE).toBe('DELTA_ONLY');
    expect(absenceHasMeaning()).toBe(false);
    const policyUrl = new URL('../../reference/sources/jonkoping-event-calendar.v1.json', import.meta.url);
    const policy = JSON.parse(await readFile(policyUrl, 'utf8')) as Record<string, unknown>;
    expect(policy).toMatchObject({
      persistencePermission: 'EXTRACTED_FIELDS_ONLY',
      refreshMode: 'DELTA_ONLY',
      multiOccurrencePolicy: 'UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY',
      cardinalityChangePolicy: 'IDENTITY_BECAME_AMBIGUOUS',
      enabledForSmoke: true,
      enabledForIngestion: false,
    });
  });

  it('parses only permitted fields from the sanitized real fixture', async () => {
    const fixtureUrl = new URL(
      '../../packages/source-adapters/fixtures/events/jonkoping-event-calendar.single-occurrence.sanitized.json',
      import.meta.url,
    );
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as { events: Array<Record<string, unknown>> };
    const allowed = new Set([
      'sourceEventUuid', 'externalKey', 'title', 'start', 'end', 'timeZone', 'venueName', 'city',
      'address', 'latitude', 'longitude', 'categories', 'sourceUrl', 'status',
    ]);
    expect(fixture.events.length).toBeGreaterThanOrEqual(2);
    for (const event of fixture.events) {
      expect(Object.keys(event).every((key) => allowed.has(key))).toBe(true);
      expect(event.externalKey).toBe(`event/${event.sourceEventUuid}`);
      expect(event.timeZone).toBe('Europe/Stockholm');
    }
    expect(JSON.stringify(fixture)).not.toMatch(/description|image|applicant|organizer|email|phone/i);
  });

  it('contains no ingestion, canonical Event, or publication write path', async () => {
    const sourceUrl = new URL('../../packages/source-adapters/src/jonkoping-events.ts', import.meta.url);
    const source = await readFile(sourceUrl, 'utf8');
    expect(source).not.toMatch(/runIngestion|Postgres|app\.events|canonical_entities|search_documents/i);
    expect(EventSourceProbeError).toBeTypeOf('function');
  });
});
