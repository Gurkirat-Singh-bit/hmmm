/**
 * @file IdeaContextStrip.tsx
 * @description Collapsible gist context kept alongside an idea conversation.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp,
  LightbulbIcon as Lightbulb,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, onboardingFonts } from "@/constants/theme";
export function IdeaContextStrip({ gist }: { gist: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const content =
    gist?.trim() ||
    "The saved report is not ready yet. Earlier messages remain available.";

  useEffect(() => setExpanded(false), [gist]);

  return (
    <View style={styles.context}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <View style={styles.labelRow}>
          <Lightbulb color={colors.ink} size={16} weight="fill" />
          <Text style={styles.label}>Idea context</Text>
        </View>
        <View>
          {expanded ? (
            <CaretUp color={colors.ink} size={16} weight="bold" />
          ) : (
            <CaretDown color={colors.ink} size={16} weight="bold" />
          )}
        </View>
      </Pressable>
      <Text numberOfLines={expanded ? undefined : 2} style={styles.gist}>
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  context: {
    gap: 1,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.primarySoft,
  },
  toggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 14,
  },
  gist: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.65 },
});
