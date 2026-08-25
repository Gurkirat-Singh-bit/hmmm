/**
 * @file DiscussionNotFound.tsx
 * @description Recovery state for an unknown or removed discussion idea.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowLeftIcon as ArrowLeft } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

export function DiscussionNotFound({ onBack, onVault }: { onBack(): void; onVault(): void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable accessibilityLabel="Back to Discuss" accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.circle, pressed && styles.pressed]}><ArrowLeft color={colors.ink} size={21} weight="bold" /></Pressable>
      <View style={styles.copy}><Text style={styles.eyebrow}>CONVERSATION NOT FOUND</Text><Text accessibilityRole="header" style={styles.title}>This idea is no longer here.</Text><Text style={styles.body}>It may have been removed, or the link may be incomplete. Choose another idea from Discuss or return to the Vault.</Text><View style={styles.actions}><Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>Back to Discuss</Text></Pressable><Pressable accessibilityRole="button" onPress={onVault} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Open Vault</Text></Pressable></View></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: spacing.page, paddingTop: 10, backgroundColor: colors.canvas },
  circle: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 23 },
  copy: { flex: 1, justifyContent: 'center', paddingBottom: 70 },
  eyebrow: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  title: { maxWidth: 320, marginTop: 8, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 29, lineHeight: 34 },
  body: { maxWidth: 330, marginTop: 10, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 24 },
  primary: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: colors.ink },
  primaryText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  secondary: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill },
  secondaryText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  pressed: { opacity: 0.7 },
});
