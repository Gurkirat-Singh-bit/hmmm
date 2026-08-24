/**
 * @file IdeaDetailHeader.tsx
 * @description Conventional back header and title for a Vault idea.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowLeftIcon as ArrowLeft, ShareNetworkIcon as ShareNetwork, StarIcon as Star } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaDetailHeader({ accentColor, onShare, onToggleStar, starred, title }: { accentColor: string; onShare(): void; onToggleStar(): void; starred: boolean; title: string }) {
  const router = useRouter();
  return <View><View style={styles.actions}><Pressable accessibilityLabel="Back to Vault" accessibilityRole="button" onPress={() => router.back()} style={styles.circle}><ArrowLeft color={colors.ink} size={21} weight="bold" /></Pressable><View style={styles.trailing}><Pressable accessibilityLabel={starred ? 'Remove star' : 'Star idea'} accessibilityRole="button" onPress={onToggleStar} style={[styles.circle, starred && { backgroundColor: accentColor, borderColor: accentColor }]}><Star color={colors.ink} size={19} weight={starred ? 'fill' : 'regular'} /></Pressable><Pressable accessibilityLabel="Share idea" accessibilityRole="button" onPress={onShare} style={styles.circle}><ShareNetwork color={colors.ink} size={19} weight="bold" /></Pressable></View></View><Text style={styles.kicker}>IDEA REPORT</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.meta}>Ready · Saved locally</Text></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, circle: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, backgroundColor: colors.canvas },
  trailing: { flexDirection: 'row', gap: 8 },
  kicker: { marginTop: 28, color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1.2 }, title: { maxWidth: 350, marginTop: 7, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.7 }, meta: { marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 11 },
});
