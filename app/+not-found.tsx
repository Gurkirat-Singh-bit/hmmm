/**
 * @file +not-found.tsx
 * @description Expo Router fallback screen for routes that do not exist.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="text" style={styles.eyebrow}>404</Text>
      <Text accessibilityRole="header" style={styles.title}>That thought wandered off.</Text>
      <Text style={styles.body}>The page you opened does not exist. Return to Home and keep capturing.</Text>
      <Pressable accessibilityLabel="Return to Home" accessibilityRole="button" accessibilityHint="Opens the guarded Home screen" onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  screen: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: spacing.page, paddingVertical: 24, backgroundColor: colors.canvas },
  eyebrow: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyBold, fontSize: 12, letterSpacing: 1.5 },
  title: { maxWidth: 320, marginTop: 10, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 34, lineHeight: 39 },
  body: { maxWidth: 340, marginTop: 10, color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 15, lineHeight: 22 },
  button: { minHeight: 52, justifyContent: 'center', marginTop: 28, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.primary },
  buttonText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 15 },
  pressed: { opacity: 0.7 },
});
