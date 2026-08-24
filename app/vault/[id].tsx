/**
 * @file [id].tsx
 * @description Dynamic Vault idea report route with an unknown-idea state.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IdeaDetailHeader } from '@/components/vault/IdeaDetailHeader';
import { IdeaReportSections } from '@/components/vault/IdeaReportSections';
import { IdeaSourceAudio } from '@/components/vault/IdeaSourceAudio';
import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';
import { previewIdeaReports, previewVaultIdeas } from '@/features/vault/vault-preview';

export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const idea = previewVaultIdeas.find((item) => item.id === id);
  const report = id ? previewIdeaReports[id] : undefined;
  const [starred, setStarred] = useState(idea?.starred ?? false);
  if (!idea || !report) return <SafeAreaView style={styles.missing}><Text style={styles.missingTitle}>This idea is not in your Vault.</Text><Text style={styles.missingBody}>It may have been removed or the link may be incomplete.</Text><Pressable accessibilityRole="button" onPress={() => router.replace('/vault')} style={styles.backButton}><Text style={styles.backText}>Back to Vault</Text></Pressable></SafeAreaView>;
  const accent = idea.accent === 'pink' ? { strong: colors.happy, soft: colors.happySoft } : idea.accent === 'mint' ? { strong: colors.calm, soft: colors.calmSoft } : { strong: colors.primary, soft: colors.primarySoft };
  const shareIdea = () => void Share.share({ message: `${idea.title}\n\n${report.gist}\n\nNext move: ${report.nextMove}`, title: idea.title });
  return <SafeAreaView edges={['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><IdeaDetailHeader accentColor={accent.strong} onShare={shareIdea} onToggleStar={() => setStarred((value) => !value)} starred={starred} title={idea.title} /><IdeaSourceAudio accentColor={accent.strong} surfaceColor={accent.soft} transcript={report.originalWords} /><IdeaReportSections report={report} /></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 36 }, missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas }, missingTitle: { color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 25, textAlign: 'center' }, missingBody: { maxWidth: 300, marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' }, backButton: { height: 50, justifyContent: 'center', marginTop: 20, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.ink }, backText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
});
