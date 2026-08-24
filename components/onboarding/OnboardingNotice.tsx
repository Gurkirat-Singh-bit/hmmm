/**
 * @file OnboardingNotice.tsx
 * @description Modal notice for onboarding validation and save errors.
 * @author Gurkirat Singh
 * @license MIT
 */

import { WarningCircleIcon as WarningCircle, XIcon as X } from 'phosphor-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import { OnboardingNotice as Notice } from '@/features/onboarding/use-onboarding-flow';

export function OnboardingNotice({ notice, onClose }: { notice: Notice; onClose(): void }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(notice)}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.icon}><WarningCircle color={colors.ink} size={25} weight="bold" /></View>
          <Pressable accessibilityLabel="Close message" hitSlop={12} onPress={onClose} style={styles.close}><X color={colors.inkMuted} size={20} weight="bold" /></Pressable>
          <Text style={styles.title}>{notice?.title}</Text>
          <Text style={styles.body}>{notice?.body}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>Try again</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.68)' },
  card: { width: '100%', maxWidth: 380, padding: 22, borderRadius: radii.large, backgroundColor: colors.canvas },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.dangerSoft },
  close: { position: 'absolute', top: 20, right: 20 },
  title: { marginTop: 20, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 23 },
  body: { marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: radii.medium, backgroundColor: colors.ink },
  buttonText: { color: colors.inkInverse, fontFamily: onboardingFonts.displaySemiBold, fontSize: 14 }, pressed: { opacity: 0.72 },
});
