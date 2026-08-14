import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
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
  startSearch,
} from './src/search';

export default function App() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState(initialSearchState);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const search = async () => {
    const request = createSearchRequest(query);
    if (!request.query) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestGeneration = generation.current + 1;
    generation.current = requestGeneration;
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>JÖNKÖPING TRIAL</Text>
        <Text style={styles.title}>Lemon Going-Out Search</Text>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Search places"
            autoCapitalize="none"
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Search places"
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!query.trim()}
            onPress={search}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Search</Text>
          </Pressable>
        </View>
        {state.status === 'loading' && <ActivityIndicator accessibilityLabel="Searching" />}
        {state.status === 'empty' && <Text style={styles.body}>No places found.</Text>}
        {state.status === 'error' && <Text style={styles.body}>{state.message}</Text>}
        {state.results.map((place) => (
          <View key={place.canonicalId} style={styles.card}>
            <Text style={styles.cardTitle}>{place.name}</Text>
            {place.categories.length > 0 && (
              <Text style={styles.body}>{place.categories.map((category) => category.label).join(', ')}</Text>
            )}
            {place.factualSummary && <Text style={styles.body}>{place.factualSummary}</Text>}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fffbe6',
  },
  content: {
    flex: 1,
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
  cardTitle: {
    color: '#202400',
    fontSize: 18,
    fontWeight: '700',
  },
});
