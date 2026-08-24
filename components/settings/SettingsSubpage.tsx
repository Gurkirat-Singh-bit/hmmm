/**
 * @file SettingsSubpage.tsx
 * @description Shared safe-area shell for secondary settings pages.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowLeftIcon as ArrowLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

export function SettingsSubpage({ children, supporting, title }: { children: ReactNode; supporting: string; title: string }) {
  const router = useRouter();
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><ArrowLeft color={colors.ink} size={22} weight="bold" /></Pressable></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.supporting}>{supporting}</Text><View style={styles.body}>{children}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvasSoft }, header: { height: 56, justifyContent: 'center', paddingHorizontal: spacing.page },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingBottom: 32 }, title: { marginTop: 10, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 30, letterSpacing: -0.7 },
  supporting: { maxWidth: 330, marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 15, lineHeight: 21 }, body: { marginTop: spacing.section }, pressed: { opacity: 0.65 },
});
