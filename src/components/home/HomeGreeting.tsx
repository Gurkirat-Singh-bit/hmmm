/**
 * @file HomeGreeting.tsx
 * @description Branded greeting area for the primary capture screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from "react-native";
import { MainBrandHeader } from "@/components/MainBrandHeader";
import { colors, onboardingFonts } from "@/constants/theme";
export function HomeGreeting({ name }: { name: string }) {
  return (
    <View>
      <MainBrandHeader />
      <View style={styles.copy}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
          Hello, {name}
        </Text>
        <Text style={styles.body}>What idea is on your mind today?</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { marginTop: 22 },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 29,
    letterSpacing: -0.8,
  },
  body: {
    marginTop: 6,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
  },
});
