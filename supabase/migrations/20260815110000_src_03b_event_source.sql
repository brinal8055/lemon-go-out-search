-- SRC-03B: enable the approved bounded municipal Event source.

insert into app.sources (
  id, key, name, kind, base_url, licence, licence_url, terms_url, attribution,
  persistence_permission, refresh_mode, rate_limit_requests,
  rate_limit_window_seconds, adapter_version, credentials_secret_name, enabled
) values (
  '8e812a50-874e-4a33-98ed-a1f2a8ea34ab',
  'JONKOPING_EVENT_CALENDAR',
  'Jönköping municipality Event Calendar',
  'EVENT_FEED',
  'https://www.jonkoping.se/evenemangskalender',
  'Jönköping municipal open-data/PSI statement',
  'https://www.jonkoping.se/kommun--politik/fakta-kartor-och-statistik/oppna-data-information-tillganglig-for-ateranvandning',
  'https://www.jonkoping.se/kommun--politik/fakta-kartor-och-statistik/oppna-data-information-tillganglig-for-ateranvandning',
  'Jönköpings kommun',
  'EXTRACTED_FIELDS_ONLY',
  'DELTA_ONLY',
  11,
  60,
  'jonkoping-event-v1',
  null,
  true
)
on conflict (key) do update set
  name = excluded.name,
  kind = excluded.kind,
  base_url = excluded.base_url,
  licence = excluded.licence,
  licence_url = excluded.licence_url,
  terms_url = excluded.terms_url,
  attribution = excluded.attribution,
  persistence_permission = excluded.persistence_permission,
  refresh_mode = excluded.refresh_mode,
  rate_limit_requests = excluded.rate_limit_requests,
  rate_limit_window_seconds = excluded.rate_limit_window_seconds,
  adapter_version = excluded.adapter_version,
  credentials_secret_name = excluded.credentials_secret_name,
  enabled = excluded.enabled;
