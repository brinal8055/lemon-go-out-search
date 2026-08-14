import type { UiLocale } from '@lemon/contracts';

type LocaleText = {
  browse: string;
  categoriesUnavailable: string;
  loading: string;
  noResults: string;
  retry: string;
  search: string;
  searchPlaceholder: string;
  unavailable: string;
};

const copy: Record<UiLocale, LocaleText> = {
  en: {
    browse: 'Browse categories',
    categoriesUnavailable: 'Categories are temporarily unavailable.',
    loading: 'Searching',
    noResults: 'No places found.',
    retry: 'Retry',
    search: 'Search',
    searchPlaceholder: 'Search places',
    unavailable: 'Search is temporarily unavailable. Try again.',
  },
  sv: {
    browse: 'Bläddra bland kategorier',
    categoriesUnavailable: 'Kategorier är tillfälligt otillgängliga.',
    loading: 'Söker',
    noResults: 'Inga platser hittades.',
    retry: 'Försök igen',
    search: 'Sök',
    searchPlaceholder: 'Sök platser',
    unavailable: 'Sökningen är tillfälligt otillgänglig. Försök igen.',
  },
} as const;

export function localizedText(locale: UiLocale): LocaleText {
  return copy[locale];
}
