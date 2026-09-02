/**
 * @file VaultHeader.tsx
 * @description Vault title and local idea count.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from "react-native";

import { MainBrandHeader } from "@/components/MainBrandHeader";
import { colors, onboardingFonts } from "@/constants/theme";
export function VaultHeader({ count }: { count: number }) {
  return (
    <View>
      <MainBrandHeader />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Vault
        </Text>
        <Text style={styles.count}>
          {count === 1 ? "1 idea" : `${count} ideas`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 22,
  },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 30,
    letterSpacing: -0.8,
  },
  count: {
    paddingBottom: 4,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 11,
  },
});
