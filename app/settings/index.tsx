/**
 * @file settings.tsx
 * @description Settings route for managing local app configuration.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter, type Href } from 'expo-router';
import { MagnifyingGlassIcon as MagnifyingGlass, TrashIcon as Trash } from 'phosphor-react-native';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { WeeklyActivityChart } from '@/components/settings/WeeklyActivityChart';
import { ForegroundFeedbackBanner } from '@/components/settings/ForegroundFeedbackBanner';
import { MainBrandHeader } from '@/components/MainBrandHeader';
import { colors } from '@/constants/theme';
import { useWeeklyActivity } from '@/features/settings/use-weekly-activity';

export default function SettingsScreen() {
  const router = useRouter();
  const activity = useWeeklyActivity();
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}><View style={styles.profile}><View style={styles.brand}><MainBrandHeader /></View><ForegroundFeedbackBanner /><WeeklyActivityChart data={activity} /></View><View style={styles.content}><SettingsMenu additionalConfiguration={[{ icon: MagnifyingGlass, label: 'Research', description: 'Transcript transfer and grounding consent', onPress: () => router.push('/settings/research' as Href) }]} additionalDataPrivacy={[{ icon: Trash, label: 'Data controls', description: 'Delete ideas or fully reset Hmmmidea', onPress: () => router.push('/settings/data' as Href) }]} onExport={() => router.push('/settings/export-data')} onGithub={() => void Linking.openURL('https://github.com/Gurkirat-Singh-bit/hmmm')} onOpenAbout={() => router.push('/settings/about')} onOpenFaq={() => router.push('/settings/faq')} onOpenGuide={() => router.push('/settings/how-to-use')} onOpenLanguage={() => router.push('/settings/language')} onOpenPrivacy={() => router.push('/settings/privacy')} onOpenProviders={() => router.push('/settings/providers')} /></View></ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, page: { flexGrow: 1, paddingBottom: 112, backgroundColor: colors.canvas },
  profile: { backgroundColor: colors.canvas }, content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 22, backgroundColor: colors.canvas },
  brand: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
});
