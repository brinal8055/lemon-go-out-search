import type { UiLocale } from '@lemon/contracts';

type LocaleText = {
  browse: string;
  categoriesUnavailable: string;
  loading: string;
  linkedVenue: string;
  noResults: string;
  place: string;
  retry: string;
  results: string;
  search: string;
  searchPlaceholder: string;
  semanticDegraded: string;
  standaloneVenue: string;
  unavailable: string;
  event: string;
};

const copy: Record<UiLocale, LocaleText> = {
  en: {
    browse: 'Browse categories',
    categoriesUnavailable: 'Categories are temporarily unavailable.',
    loading: 'Searching',
    linkedVenue: 'At',
    noResults: 'No results found.',
    place: 'Place',
    retry: 'Retry',
    results: 'Results',
    search: 'Search',
    searchPlaceholder: 'Search places and events',
    semanticDegraded: 'Showing standard search results.',
    standaloneVenue: 'Venue',
    unavailable: 'Search is temporarily unavailable. Try again.',
    event: 'Event',
  },
  sv: {
    browse: 'Bläddra bland kategorier',
    categoriesUnavailable: 'Kategorier är tillfälligt otillgängliga.',
    loading: 'Söker',
    linkedVenue: 'På',
    noResults: 'Inga resultat hittades.',
    place: 'Plats',
    retry: 'Försök igen',
    results: 'Resultat',
    search: 'Sök',
    searchPlaceholder: 'Sök platser och evenemang',
    semanticDegraded: 'Visar vanliga sökresultat.',
    standaloneVenue: 'Plats',
    unavailable: 'Sökningen är tillfälligt otillgänglig. Försök igen.',
    event: 'Evenemang',
  },
} as const;

export function localizedText(locale: UiLocale): LocaleText {
  return copy[locale];
}
