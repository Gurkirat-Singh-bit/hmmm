/**
 * @file index.tsx
 * @description Main Discuss route for continuing conversations or choosing a ready idea.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscussionList } from '@/components/discuss/DiscussionList';
import { MainBrandHeader } from '@/components/MainBrandHeader';
import { colors, onboardingFonts, spacing } from '@/constants/theme';
import { useDiscussionHome } from '@/features/discussion/use-discussion';

export default function DiscussScreen() {
  const router = useRouter();
  const discussion = useDiscussionHome();
  const openThread = (ideaId: string) => router.push({ pathname: '/discuss/[ideaId]', params: { ideaId } });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MainBrandHeader />
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Discuss</Text><Text style={styles.supporting}>Discuss through a saved idea with AI</Text></View>
        <DiscussionList
          captures={discussion.captures}
          error={discussion.error}
          loading={discussion.loading}
          onOpen={openThread}
          onRetry={discussion.refresh}
          threads={discussion.threads}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 112 },
  heading: { marginTop: 22, marginBottom: 24 },
  title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 30, letterSpacing: -0.8 },
  supporting: { marginTop: 4, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13 },
});
