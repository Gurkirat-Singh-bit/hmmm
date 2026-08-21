import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return <View style={styles.screen}><Text style={styles.eyebrow}>404</Text><Text style={styles.title}>That thought wandered off.</Text><Text style={styles.body}>The page you opened does not exist.</Text><Pressable onPress={() => router.replace('/')} style={styles.button}><Text style={styles.buttonText}>Back home</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', padding: 24, backgroundColor: colors.canvas },
  eyebrow: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { maxWidth: 320, marginTop: 10, color: colors.ink, fontSize: 34, fontWeight: '700', lineHeight: 39 },
  body: { marginTop: 10, color: colors.inkMuted, fontSize: 15 },
  button: { minHeight: 52, justifyContent: 'center', marginTop: 28, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.primary },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
});
