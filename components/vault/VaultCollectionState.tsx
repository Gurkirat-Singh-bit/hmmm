import { MicrophoneIcon as Microphone, MagnifyingGlassIcon as Search, WarningCircleIcon as Warning } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';

export function VaultCollectionState({ kind, onRetry, onStartCapture }: {
  kind: 'empty' | 'error' | 'loading' | 'no-results';
  onRetry?(): void;
  onStartCapture?(): void;
}) {
  if (kind === 'loading') {
    return <View accessibilityLabel="Loading ideas" style={styles.loading}>
      <View style={styles.skeleton} /><View style={styles.skeleton} /><View style={styles.skeleton} />
    </View>;
  }
  const copy = kind === 'empty'
    ? { icon: Microphone, title: 'Your ideas will live here.', body: 'Record a thought and it will appear in your local Vault straight away.', action: 'Record an idea' }
    : kind === 'error'
      ? { icon: Warning, title: 'The Vault could not load.', body: 'Your ideas remain on this device. Try loading them again.', action: 'Try again' }
      : { icon: Search, title: 'No ideas match that.', body: 'Try a shorter search or clear one of your filters.', action: null };
  const Icon = copy.icon;
  const onPress = kind === 'empty' ? onStartCapture : onRetry;
  return <View style={styles.panel}>
    <View style={styles.icon}><Icon color={colors.ink} size={25} weight="bold" /></View>
    <Text style={styles.title}>{copy.title}</Text>
    <Text style={styles.body}>{copy.body}</Text>
    {copy.action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.actionText}>{copy.action}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  loading: { gap: 10, marginTop: 22 },
  skeleton: { height: 106, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  panel: { alignItems: 'center', marginTop: 22, padding: 24, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primary },
  title: { marginTop: 14, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 19, textAlign: 'center' },
  body: { maxWidth: 290, marginTop: 7, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  action: { minHeight: 48, justifyContent: 'center', marginTop: 18, paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: colors.ink },
  actionText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  pressed: { opacity: 0.64 },
});
