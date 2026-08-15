import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

type UiLocale = 'en' | 'sv';
type DiscoveryRequest = { query: string; taxonomyNodeId?: string };

export default function App() {
  const [query, setQuery] = useState('');
  const [uiLocale, setUiLocale] = useState<UiLocale>('en');
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [taxonomyUnavailable, setTaxonomyUnavailable] = useState(false);
  const [state, setState] = useState(initialSearchState);
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

  const searchText = () => void search({ query });
  const searchCategory = (taxonomyNodeId: string) => void search({ query: '', taxonomyNodeId });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>JÖNKÖPING TRIAL</Text>
        <Text style={styles.title}>Lemon Going-Out Search</Text>
        <View style={styles.localeRow}>
          {(['en', 'sv'] as const).map((locale) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: uiLocale === locale }}
              key={locale}
              onPress={() => setUiLocale(locale)}
              style={styles.localeButton}
            >
              <Text style={styles.localeText}>{locale === 'en' ? 'English' : 'Svenska'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel={text.searchPlaceholder}
            autoCapitalize="none"
            onChangeText={setQuery}
            onSubmitEditing={searchText}
            placeholder={text.searchPlaceholder}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!query.trim()}
            onPress={searchText}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{text.search}</Text>
          </Pressable>
        </View>
        <Text style={styles.browseTitle}>{text.browse}</Text>
        {taxonomyUnavailable && <Text style={styles.body}>{text.categoriesUnavailable}</Text>}
        <View style={styles.categories}>
          {taxonomy.map((node) => (
            <Pressable
              accessibilityRole="button"
              key={node.id}
              onPress={() => searchCategory(node.id)}
              style={[styles.category, { marginLeft: node.depth * 12 }]}
            >
              <Text style={styles.categoryText}>{taxonomyLabel(node, uiLocale)}</Text>
            </Pressable>
          ))}
        </View>
        {state.status === 'loading' && <ActivityIndicator accessibilityLabel={text.loading} />}
        {state.status === 'empty' && <Text style={styles.body}>{text.noResults}</Text>}
        {state.status === 'error' && (
          <View>
            <Text style={styles.body}>{text.unavailable}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => { if (lastRequest.current) void search(lastRequest.current); }}
              style={styles.retryButton}
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
          <View accessible key={result.canonicalId} style={styles.card}>
            <Text style={styles.cardTitle}>{result.name}</Text>
            {result.categories.length > 0 && (
              <Text style={styles.body}>{result.categories.map((category) => category.label).join(', ')}</Text>
            )}
            {result.factualSummary && <Text style={styles.body}>{result.factualSummary}</Text>}
          </View>
        ) : (
          <EventResultCard event={result} key={result.canonicalId} locale={uiLocale} />
        ))}
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
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{event.title}</Text>
      {event.categories.length > 0 && (
        <Text style={styles.body}>{event.categories.map((category) => category.label).join(', ')}</Text>
      )}
      <Text style={styles.eventTime}>{time}</Text>
      <Text style={styles.body}>{venue}</Text>
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
    padding: 24,
  },
  eyebrow: {
    color: '#637000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#202400',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  body: {
    color: '#4c5200',
    fontSize: 16,
    marginTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  localeRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 12,
  },
  localeButton: {
    borderColor: '#637000',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  localeText: {
    color: '#4c5200',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#637000',
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  button: {
    backgroundColor: '#637000',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    padding: 16,
  },
  degradedNotice: {
    color: '#4c5200',
    fontSize: 14,
    marginTop: 16,
  },
  browseTitle: {
    color: '#202400',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
  },
  categories: {
    gap: 8,
    marginTop: 12,
  },
  category: {
    borderColor: '#c3cb84',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    padding: 10,
  },
  categoryText: {
    color: '#4c5200',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#637000',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardTitle: {
    color: '#202400',
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  eventTime: {
    color: '#202400',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  locality: {
    color: '#4c5200',
    fontSize: 14,
    marginTop: 6,
  },
});
