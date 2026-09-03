/**
 * @file search-api.tsx
 * @description Dedicated settings route for a protected SerpApi credential.
 * @author Gurkirat Singh
 * @license MIT
 */

import * as Linking from "expo-linking";
import { ArrowSquareOutIcon as ArrowSquareOut } from "phosphor-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";

import { SecretField } from "@/components/onboarding/OnboardingFields";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { SERPAPI_MANAGE_KEY_URL } from "@/features/provider/config";
import { useResearchSettings } from "@/features/settings/use-research-settings";

export default function SearchApiSettingsScreen() {
  const settings = useResearchSettings();
  const [attempted, setAttempted] = useState(false);
  const disabled = settings.loading || settings.saving;
  const save = () => {
    setAttempted(true);
    void settings.saveSearchKey();
  };

  return (
    <SettingsSubpage
      supporting="Connect Google search results to idea reports."
      title="Search API"
    >
      <View style={styles.explainer}>
        <Text style={styles.explainerTitle}>What SerpApi does</Text>
        <Text style={styles.explainerBody}>
          It searches Google once per researched report. It is not used for
          recording, transcription, or Discuss.
        </Text>
      </View>

      <View style={styles.form}>
        <SecretField
          attempted={attempted && !settings.searchKey.trim()}
          label="SERPAPI KEY"
          light
          onChangeText={settings.setSearchKey}
          placeholder="Paste your key"
          value={settings.searchKey}
        />
        <Pressable
          accessibilityHint="Opens the official SerpApi account page"
          accessibilityLabel="Get a SerpApi key"
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(SERPAPI_MANAGE_KEY_URL).catch(() => undefined)
          }
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkText}>Get a key from SerpApi</Text>
          <ArrowSquareOut color={colors.ink} size={18} weight="bold" />
        </Pressable>
      </View>

      <Text style={styles.privacy}>
        The key stays in your device&apos;s secure key store. SerpApi may retain
        standard searches for 31 days.
      </Text>
      {settings.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Verify and save SerpApi key"
        accessibilityRole="button"
        accessibilityState={{ busy: settings.saving, disabled }}
        disabled={disabled}
        onPress={save}
        style={({ pressed }) => [
          styles.save,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {settings.saving ? (
          <ActivityIndicator color={colors.inkInverse} />
        ) : (
          <Text style={styles.saveText}>Verify and save key</Text>
        )}
      </Pressable>
    </SettingsSubpage>
  );
}

const styles = StyleSheet.create({
  explainer: {
    gap: 6,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.primarySoft,
  },
  explainerTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
  },
  explainerBody: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  form: {
    gap: 10,
    marginTop: 16,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  link: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
  },
  linkText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  privacy: {
    marginTop: 14,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 17,
  },
  message: {
    marginTop: 12,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  save: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  saveText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 14,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
