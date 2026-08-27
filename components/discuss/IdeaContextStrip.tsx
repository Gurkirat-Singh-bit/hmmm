/**
 * @file IdeaContextStrip.tsx
 * @description Collapsible gist context kept alongside an idea conversation.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaContextStrip({ gist }: { gist: string | null }) {
  return (
    <View style={styles.context}>
      <Text style={styles.label}>Idea gist</Text>
      <Text style={styles.gist}>{gist?.trim() || 'The saved report is not ready yet. Earlier messages remain available.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  context: { gap: 6, marginHorizontal: 20, marginTop: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  label: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 14 },
  gist: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
});
