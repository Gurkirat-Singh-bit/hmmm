/**
 * @file settings.tsx
 * @description Settings route for managing local app configuration.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { WeeklyActivityChart } from '@/components/settings/WeeklyActivityChart';
import { MainBrandHeader } from '@/components/MainBrandHeader';
import { colors } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}><View style={styles.profile}><View style={styles.brand}><MainBrandHeader /></View><WeeklyActivityChart /></View><View style={styles.content}><SettingsMenu onExport={() => router.push('/settings/export-data')} onGithub={() => void Linking.openURL('https://github.com/Gurkirat-Singh-bit/hmmm')} onOpenAbout={() => router.push('/settings/about')} onOpenFaq={() => router.push('/settings/faq')} onOpenGuide={() => router.push('/settings/how-to-use')} onOpenLanguage={() => router.push('/settings/language')} onOpenPrivacy={() => router.push('/settings/privacy')} onOpenProviders={() => router.push('/settings/providers')} /></View></ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, page: { flexGrow: 1, paddingBottom: 112, backgroundColor: colors.canvas },
  profile: { backgroundColor: colors.canvas }, content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 22, backgroundColor: colors.canvas },
  brand: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
});
