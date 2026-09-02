/**
 * @file ForegroundFeedbackBanner.tsx
 * @description In-app completion feedback shown while Hmmmidea is in the foreground.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CheckCircleIcon as CheckCircle,
  WarningCircleIcon as WarningCircle,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import {
  subscribeToForegroundFeedback,
  type ForegroundFeedback,
} from "@/features/notifications/foreground-feedback";

/** Generic in-app completion feedback never discloses an idea’s content. */
export function ForegroundFeedbackBanner() {
  const [feedback, setFeedback] = useState<ForegroundFeedback | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeToForegroundFeedback(setFeedback);
    return () => {
      unsubscribe();
    };
  }, []);
  if (!feedback) return null;
  const warning = feedback.message.includes("needs attention");
  const Icon = warning ? WarningCircle : CheckCircle;
  return (
    <View
      accessible
      accessibilityLabel={feedback.message}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[styles.banner, warning && styles.warning]}
    >
      <Icon color={colors.ink} size={19} weight="fill" />
      <Text style={styles.text}>{feedback.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 13,
    borderRadius: radii.medium,
    backgroundColor: colors.calmSoft,
  },
  warning: { backgroundColor: colors.happySoft },
  text: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
});
