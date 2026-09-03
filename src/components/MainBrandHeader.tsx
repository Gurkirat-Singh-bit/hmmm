/**
 * @file MainBrandHeader.tsx
 * @description Shared compact brand header for primary application pages.
 * @author Gurkirat Singh
 * @license MIT
 */

import { Image, StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts } from "@/constants/theme";
export function MainBrandHeader() {
  return (
    <View accessibilityLabel="Hmmmidea" style={styles.header}>
      <Image
        resizeMode="contain"
        source={require("@/assets/brand-mark.png")}
        style={styles.logo}
      />
      <Text style={styles.name}>Hmmmidea</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 57, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48 },
  name: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 26,
    letterSpacing: -0.4,
  },
});
