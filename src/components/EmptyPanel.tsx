/**
 * @file EmptyPanel.tsx
 * @description Reusable empty-state panel for product areas without content.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts, radii } from "@/constants/theme";
export function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 7,
    padding: 20,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
  },
  body: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
});
