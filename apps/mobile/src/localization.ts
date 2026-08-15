import type { UiLocale } from '@lemon/contracts';

type LocaleText = {
  browse: string;
  categoriesUnavailable: string;
  loading: string;
  linkedVenue: string;
  noResults: string;
  retry: string;
  search: string;
  searchPlaceholder: string;
  semanticDegraded: string;
  standaloneVenue: string;
  unavailable: string;
};

const copy: Record<UiLocale, LocaleText> = {
  en: {
    browse: 'Browse categories',
    categoriesUnavailable: 'Categories are temporarily unavailable.',
    loading: 'Searching',
    linkedVenue: 'At',
    noResults: 'No results found.',
    retry: 'Retry',
    search: 'Search',
    searchPlaceholder: 'Search places and events',
    semanticDegraded: 'Showing standard search results.',
    standaloneVenue: 'Venue',
    unavailable: 'Search is temporarily unavailable. Try again.',
  },
  sv: {
    browse: 'Bläddra bland kategorier',
    categoriesUnavailable: 'Kategorier är tillfälligt otillgängliga.',
    loading: 'Söker',
    linkedVenue: 'På',
    noResults: 'Inga resultat hittades.',
    retry: 'Försök igen',
    search: 'Sök',
    searchPlaceholder: 'Sök platser och evenemang',
    semanticDegraded: 'Visar vanliga sökresultat.',
    standaloneVenue: 'Plats',
    unavailable: 'Sökningen är tillfälligt otillgänglig. Försök igen.',
  },
} as const;

export function localizedText(locale: UiLocale): LocaleText {
  return copy[locale];
}
