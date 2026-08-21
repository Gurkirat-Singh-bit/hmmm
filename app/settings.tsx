import { Key, ShieldCheck } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { colors, radii } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <AppScreen eyebrow="SETTINGS" title="Simple controls. Clear storage." supporting="Provider keys stay in your device’s protected storage.">
      <View style={styles.card}><ShieldCheck color={colors.ink} size={23} weight="bold" /><View style={styles.copy}><Text style={styles.title}>Credentials configured</Text><Text style={styles.body}>Revisit onboarding to replace your local provider keys.</Text></View></View>
      <Pressable onPress={() => router.push('/onboarding')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Key color={colors.ink} size={19} weight="bold" /><Text style={styles.buttonText}>Edit credentials</Text></Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 18, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  copy: { flex: 1, gap: 5 }, title: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  body: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: '600' }, pressed: { opacity: 0.7 },
});
