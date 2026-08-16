import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createSearchClient,
  createSearchRequest,
  initialSearchState,
  rejectSearch,
  resolveSearch,
  showSemanticDegraded,
  startSearch,
} from './src/search';
import { formatEventTime, formatEventVenue } from './src/event-presentation';
import { localizedText } from './src/localization';
import { loadActiveTaxonomy } from './src/taxonomy-reference';
import { taxonomyLabel, type TaxonomyNode } from './src/taxonomy';
import type { EventCard } from '@lemon/contracts';
import lemonLogo from './assets/lemon-logo.png';

type UiLocale = 'en' | 'sv';
type DiscoveryRequest = { query: string; taxonomyNodeId?: string };

export default function App() {
  const [query, setQuery] = useState('');
  const [uiLocale, setUiLocale] = useState<UiLocale>('en');
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [taxonomyUnavailable, setTaxonomyUnavailable] = useState(false);
  const [state, setState] = useState(initialSearchState);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const lastRequest = useRef<DiscoveryRequest | null>(null);
  const text = localizedText(uiLocale);

  useEffect(() => {
    let current = true;
    void loadActiveTaxonomy()
      .then((nodes) => { if (current) setTaxonomy(nodes); })
      .catch(() => { if (current) setTaxonomyUnavailable(true); });
    return () => { current = false; };
  }, []);

  const search = async (nextRequest: DiscoveryRequest) => {
    const request = createSearchRequest(nextRequest.query, uiLocale, nextRequest.taxonomyNodeId);
    if (!request.query && !request.taxonomyNodeId) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestGeneration = generation.current + 1;
    generation.current = requestGeneration;
    lastRequest.current = nextRequest;
    setState(startSearch());

    try {
      const client = createSearchClient(process.env.EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL ?? '');
      const response = await client(request, controller.signal);
      const next = resolveSearch(generation.current, requestGeneration, response);
      if (next) setState(next);
    } catch {
      if (!controller.signal.aborted) {
        const next = rejectSearch(generation.current, requestGeneration);
        if (next) setState(next);
      }
    }
  };

  const searchText = () => {
    if (state.status === 'loading' || !query.trim()) return;
    Keyboard.dismiss();
    void search({ query });
  };
  const searchCategory = (taxonomyNodeId: string) => {
    setExpandedCategoryId(null);
    void search({ query: '', taxonomyNodeId });
  };
  const topLevelCategories = taxonomy.filter((node) => node.parentId === null);
  const expandedCategories = expandedCategoryId === null
    ? []
    : taxonomy.filter((node) => node.parentId !== null && node.path.includes(expandedCategoryId));
  const hasSearchState = state.status !== 'idle';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Image accessibilityLabel="Lemon logo" source={lemonLogo} style={styles.logo} />
          <View style={styles.brandCopy}>
            <Text style={styles.eyebrow}>JÖNKÖPING TRIAL</Text>
            <Text style={styles.title}>Lemon Going-Out Search</Text>
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={styles.localeControl}>
          {(['en', 'sv'] as const).map((locale) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: uiLocale === locale }}
              key={locale}
              onPress={() => setUiLocale(locale)}
              style={({ pressed }) => [
                styles.localeButton,
                uiLocale === locale && styles.localeButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.localeText, uiLocale === locale && styles.localeTextSelected]}>
                {locale === 'en' ? 'English' : 'Svenska'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel={text.searchPlaceholder}
            autoCapitalize="none"
            onChangeText={setQuery}
            onBlur={() => setInputFocused(false)}
            onFocus={() => setInputFocused(true)}
            onSubmitEditing={searchText}
            placeholder={text.searchPlaceholder}
            placeholderTextColor="#73785b"
            returnKeyType="search"
            style={[styles.input, inputFocused && styles.inputFocused]}
            value={query}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !query.trim() || state.status === 'loading' }}
            disabled={!query.trim() || state.status === 'loading'}
            onPress={searchText}
            style={({ pressed }) => [
              styles.button,
              (!query.trim() || state.status === 'loading') && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>{state.status === 'loading' ? text.loading : text.search}</Text>
          </Pressable>
        </View>
        {hasSearchState && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>{text.results}</Text>
            {state.status === 'loading' && (
              <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
                <ActivityIndicator accessibilityLabel={text.loading} color="#637000" />
                <Text style={styles.body}>{text.loading}</Text>
              </View>
            )}
            {state.status === 'empty' && <Text style={styles.emptyState}>{text.noResults}</Text>}
            {state.status === 'error' && (
              <View style={styles.errorState}>
                <Text style={styles.body}>{text.unavailable}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { if (lastRequest.current) void search(lastRequest.current); }}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonText}>{text.retry}</Text>
                </Pressable>
              </View>
            )}
            {showSemanticDegraded(state) && (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="text"
                style={styles.degradedNotice}
              >
                {text.semanticDegraded}
              </Text>
            )}
            {state.results.map((result) => result.type === 'PLACE' ? (
              <View accessible key={result.canonicalId} style={[styles.card, styles.placeCard]}>
                <Text style={styles.cardKind}>{text.place}</Text>
                <Text style={styles.cardTitle}>{result.name}</Text>
                {result.categories.length > 0 && (
                  <Text style={styles.categoryPill}>{result.categories.map((category) => category.label).join(', ')}</Text>
                )}
                {result.factualSummary && <Text style={styles.cardBody}>{result.factualSummary}</Text>}
              </View>
            ) : (
              <EventResultCard event={result} key={result.canonicalId} locale={uiLocale} />
            ))}
          </View>
        )}
        <View style={[styles.browseSection, hasSearchState && styles.browseSectionCompact]}>
          <Text style={styles.browseTitle}>{text.browse}</Text>
          {taxonomyUnavailable && <Text style={styles.body}>{text.categoriesUnavailable}</Text>}
          <View style={styles.categories}>
            {topLevelCategories.map((node) => (
              <View key={node.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandedCategoryId === node.id }}
                  onPress={() => setExpandedCategoryId((current) => current === node.id ? null : node.id)}
                  style={({ pressed }) => [
                    styles.category,
                    expandedCategoryId === node.id && styles.categoryExpanded,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.categoryText, expandedCategoryId === node.id && styles.categoryTextExpanded]}>
                    {taxonomyLabel(node, uiLocale)}
                  </Text>
                  <Text style={styles.categoryChevron}>{expandedCategoryId === node.id ? '⌃' : '⌄'}</Text>
                </Pressable>
                {expandedCategoryId === node.id && expandedCategories.map((child) => (
                  <Pressable
                    accessibilityRole="button"
                    key={child.id}
                    onPress={() => searchCategory(child.id)}
                    style={({ pressed }) => [styles.categoryChild, { marginLeft: child.depth * 12 }, pressed && styles.pressed]}
                  >
                    <Text style={styles.categoryChildText}>{taxonomyLabel(child, uiLocale)}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EventResultCard({ event, locale }: { event: EventCard; locale: UiLocale }) {
  const text = localizedText(locale);
  const time = formatEventTime(event, locale);
  const venue = formatEventVenue(event, text);

  return (
    <View
      accessibilityLabel={`${event.title}. ${time}. ${venue}`}
      accessible
      style={[styles.card, styles.eventCard]}
    >
      <Text style={styles.cardKind}>{text.event}</Text>
      <Text style={styles.cardTitle}>{event.title}</Text>
      {event.categories.length > 0 && (
        <Text style={styles.categoryPill}>{event.categories.map((category) => category.label).join(', ')}</Text>
      )}
      <Text style={styles.eventTime}>{time}</Text>
      <Text style={styles.cardBody}>{venue}</Text>
      {event.location.locality && <Text style={styles.locality}>{event.location.locality}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fffbe6',
  },
  content: {
    padding: 20,
    paddingBottom: 44,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  brandCopy: {
    flexShrink: 1,
  },
  logo: {
    borderRadius: 28,
    height: 56,
    marginRight: 10,
    width: 56,
  },
  eyebrow: {
    color: '#637000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#202400',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  body: {
    color: '#4c5200',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 22,
  },
  localeControl: {
    backgroundColor: '#edf0c8',
    borderColor: '#c3cb84',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 3,
  },
  localeButton: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  localeButtonSelected: {
    backgroundColor: '#637000',
  },
  localeText: {
    color: '#4c5200',
    fontWeight: '700',
  },
  localeTextSelected: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#c3cb84',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: '#637000',
    borderWidth: 2,
  },
  button: {
    backgroundColor: '#637000',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9da56d',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  placeCard: {
    borderColor: '#d6dca7',
  },
  eventCard: {
    borderColor: '#b9d5c1',
  },
  cardKind: {
    color: '#637000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardBody: {
    color: '#4c5200',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f2f4dc',
    borderRadius: 10,
    color: '#4c5200',
    fontSize: 14,
    marginTop: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultsSection: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#202400',
    fontSize: 20,
    fontWeight: '700',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderColor: '#d6dca7',
    borderRadius: 14,
    borderWidth: 1,
    color: '#4c5200',
    fontSize: 16,
    marginTop: 12,
    padding: 14,
  },
  errorState: {
    backgroundColor: '#ffffff',
    borderColor: '#d6dca7',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  degradedNotice: {
    color: '#4c5200',
    fontSize: 14,
    marginTop: 10,
  },
  browseSection: {
    marginTop: 26,
  },
  browseSectionCompact: {
    marginTop: 30,
  },
  browseTitle: {
    color: '#202400',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 0,
  },
  categories: {
    gap: 8,
    marginTop: 10,
  },
  category: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#c3cb84',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  categoryExpanded: {
    backgroundColor: '#edf0c8',
    borderColor: '#637000',
  },
  categoryText: {
    color: '#4c5200',
    flex: 1,
    fontWeight: '600',
  },
  categoryTextExpanded: {
    color: '#202400',
  },
  categoryChevron: {
    color: '#637000',
    fontSize: 18,
  },
  categoryChild: {
    backgroundColor: '#ffffff',
    borderColor: '#d6dca7',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  categoryChildText: {
    color: '#4c5200',
    fontSize: 15,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#637000',
    marginTop: 12,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardTitle: {
    color: '#202400',
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '700',
  },
  eventTime: {
    color: '#202400',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  locality: {
    color: '#4c5200',
    fontSize: 14,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.78,
  },
});
