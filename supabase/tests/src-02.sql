begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(16);

select is((select count(*)::integer from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 1, 'exactly one municipal Utegym source is seeded');
select is((select kind from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'MUNICIPAL', 'source kind is MUNICIPAL');
select is((select name from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'Jönköpings kommun Utegym', 'official source name is retained');
select is((select base_url from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'https://gis.jonkoping.se/arcgis/rest/services/open_data_digg/MapServer/41', 'selected layer endpoint is retained');
select is((select licence from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'CC0-1.0', 'official CC0 licence is retained');
select is((select licence_url from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'https://creativecommons.org/publicdomain/zero/1.0/deed.sv', 'licence reference is retained');
select is((select terms_url from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'https://data-jonkoping.opendata.arcgis.com/', 'official portal terms are retained');
select is((select attribution from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'Jönköpings kommun', 'publisher attribution is retained');
select is((select persistence_permission from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'EXTRACTED_FIELDS_ONLY', 'only reviewed factual fields persist');
select is((select refresh_mode::text from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'DELTA_ONLY', 'absence has no snapshot meaning');
select is((select rate_limit_requests from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), null, 'no undocumented source rate is invented');
select is((select rate_limit_window_seconds from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), null, 'no undocumented rate window is invented');
select is((select adapter_version from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'jonkoping-utegym-arcgis-v1', 'registry and adapter versions match');
select is((select credentials_secret_name from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), null, 'public layer requires no credential secret');
select ok((select enabled from app.sources where key = 'JONKOPING_MUNICIPAL_UTEGYM'), 'positively reviewed source is enabled');
select is((select count(*)::integer from app.sources where key like 'JONKOPING_MUNICIPAL_%'), 1, 'no unselected municipal layer is added');

select * from finish();
rollback;
