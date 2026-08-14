import {
  compareRepeatedProbe,
  JonkopingEventProbe,
} from './jonkoping-events.ts';

const probe = new JonkopingEventProbe();
const first = await probe.fetch(new AbortController().signal);
const second = await probe.fetch(new AbortController().signal);
const repeat = compareRepeatedProbe(first, second);

if (first.accepted.length === 0 || repeat.repeatedExternalKeys.length === 0) {
  console.error('STABLE_OCCURRENCE_IDENTITY_BLOCKED: no repeatable single-occurrence Event was found');
  process.exit(1);
}

console.log(JSON.stringify({
  source: first.sourceKey,
  refreshMode: first.refreshMode,
  runs: [
    {
      requests: first.searchRequests + first.detailRequests,
      fetchedHits: first.fetchedHits,
      singleOccurrenceUsable: first.accepted.length,
      multiOccurrenceSkipped: first.multiOccurrenceSkipped,
      invalid: first.invalid,
    },
    {
      requests: second.searchRequests + second.detailRequests,
      fetchedHits: second.fetchedHits,
      singleOccurrenceUsable: second.accepted.length,
      multiOccurrenceSkipped: second.multiOccurrenceSkipped,
      invalid: second.invalid,
    },
  ],
  repeatedStableIds: repeat.repeatedExternalKeys.length,
  exampleExternalKey: repeat.repeatedExternalKeys[0],
  scheduleChanges: repeat.scheduleChanges,
  sample: first.accepted.slice(0, 5).map((event) => ({
    externalKey: event.externalKey,
    start: event.start,
    end: event.end,
    timeZone: event.timeZone,
    venueName: event.venueName,
    city: event.city,
    categories: event.categories,
  })),
}));
