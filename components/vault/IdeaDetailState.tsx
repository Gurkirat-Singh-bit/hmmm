import { ArrowLeftIcon as ArrowLeft, WarningCircleIcon as Warning } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaDetailState({ kind, onBack, onRetry }: { kind: 'loading' | 'missing' | 'error'; onBack(): void; onRetry?(): void }) {
  if (kind === 'loading') return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}><View accessibilityLabel="Loading idea" style={styles.loading}><View style={styles.line} /><View style={styles.title} /><View style={styles.card} /><View style={styles.card} /></View></SafeAreaView>;
  const error = kind === 'error';
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}><View style={styles.wrap}>
    <View style={styles.icon}>{error ? <Warning color={colors.ink} size={27} weight="bold" /> : <ArrowLeft color={colors.ink} size={27} weight="bold" />}</View>
    <Text accessibilityRole="header" style={styles.titleText}>{error ? 'This idea could not load.' : 'This idea was deleted or cannot be found.'}</Text>
    <Text style={styles.body}>{error ? 'Your local data is still safe. Try again, or return to the Vault.' : 'It may have been deleted from this device, or this link is incomplete.'}</Text>
    <View style={styles.actions}>{error && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>Try again</Text></Pressable> : null}<Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Back to Vault</Text></Pressable></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, gap: 16, padding: 20, backgroundColor: colors.canvas },
  line: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceMuted },
  title: { width: '76%', height: 64, borderRadius: radii.medium, backgroundColor: colors.surfaceMuted },
  card: { height: 140, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.canvas },
  icon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.primarySoft },
  titleText: { maxWidth: 320, marginTop: 18, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 25, lineHeight: 30, textAlign: 'center' },
  body: { maxWidth: 290, marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 },
  primary: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: colors.ink },
  primaryText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  secondary: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  secondaryText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  pressed: { opacity: 0.62 },
});
