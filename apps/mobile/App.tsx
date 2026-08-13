import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>JÖNKÖPING TRIAL</Text>
        <Text style={styles.title}>Lemon Going-Out Search</Text>
        <Text style={styles.body}>Repository bootstrap is ready.</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
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
});
