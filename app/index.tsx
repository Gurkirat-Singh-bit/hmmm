import { Microphone } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { colors, radii } from '@/constants/theme';
import { isOnboardingComplete, readProfile } from '@/features/onboarding/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([isOnboardingComplete(), readProfile()]).then(([complete, profile]) => {
      if (!complete) return router.replace('/onboarding');
      setName(profile?.name ?? 'there');
      setReady(true);
    });
  }, [router]);

  if (!ready) return <View style={styles.loading} />;

  return (
    <AppScreen eyebrow="HMMMIDEA" title={`Hello, ${name}.\nWhat’s on your mind?`} supporting="Speak freely. We’ll keep the original thought and shape it later.">
      <View style={styles.captureArea}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.record, pressed && styles.pressed]}>
          <Microphone color={colors.ink} size={26} weight="bold" />
          <Text style={styles.recordLabel}>Record a thought</Text>
        </Pressable>
        <Text style={styles.note}>Recorder wiring comes next. This shell proves the intended flow.</Text>
      </View>
      <View style={styles.recent}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing here yet.</Text>
          <Text style={styles.emptyBody}>Your first captured thought will appear here.</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.canvas },
  captureArea: { alignItems: 'flex-start', gap: 12 },
  record: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, borderRadius: radii.pill, backgroundColor: colors.primary },
  recordLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  note: { maxWidth: 290, color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  recent: { marginTop: 46 }, sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  emptyCard: { gap: 5, marginTop: 14, padding: 18, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  emptyBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
});
