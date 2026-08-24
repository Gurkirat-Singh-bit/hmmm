/**
 * @file index.tsx
 * @description Home capture route and onboarding entry guard.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeGreeting } from '@/components/home/HomeGreeting';
import { RecentIdeasPreview } from '@/components/home/RecentIdeasPreview';
import { VoiceCapturePanel } from '@/components/home/VoiceCapturePanel';
import { colors, spacing } from '@/constants/theme';
import { isOnboardingComplete, readProfile } from '@/features/onboarding/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([isOnboardingComplete(), readProfile()]).then(([complete, profile]) => {
      if (!complete) return router.replace('/onboarding');
      setName(profile?.name || 'there');
      setReady(true);
    });
  }, [router]);

  if (!ready) return <View style={styles.loading} />;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeGreeting name={name} />
        <VoiceCapturePanel />
        <RecentIdeasPreview onSeeAll={() => router.push('/vault')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.canvas }, safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 112 },
});
