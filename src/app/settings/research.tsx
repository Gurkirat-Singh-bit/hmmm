/**
 * @file research.tsx
 * @description Settings route for research consent and provider-grounding preferences.
 * @author Gurkirat Singh
 * @license MIT
 */

import { CheckIcon as Check, KeyIcon as Key } from "phosphor-react-native";
import { useRouter, type Href } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { useResearchSettings } from "@/features/settings/use-research-settings";

/** Renders provider research availability, behavior, and explicit consent controls. */
export default function ResearchSettingsScreen() {
  const router = useRouter();
  const settings = useResearchSettings();
  const external = settings.source.kind === "external";
  return (
    <SettingsSubpage
      supporting="Choose if reports search the web."
      title="Search online?"
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        <ConsentOption
          active={!settings.enabled}
          body="Use only your transcript"
          disabled={settings.saving}
          label="No web search"
          onPress={() => settings.setEnabledDraft(false)}
        />
        <ConsentOption
          active={settings.enabled && !external}
          body={
            settings.provider.supportsResearch
              ? `Search with ${settings.provider.label}`
              : "Unavailable with this model"
          }
          disabled={settings.saving || !settings.provider.supportsResearch}
          label={`Use ${settings.provider.label}`}
          onPress={() => {
            settings.setSource({ kind: "ai-native" });
            settings.setEnabledDraft(true);
          }}
        />
        <ConsentOption
          active={settings.enabled && external}
          body="Google search with your own key"
          disabled={settings.saving}
          label="Use SerpApi"
          onPress={() => {
            settings.setSource({
              kind: "external",
              providerId: "serpapi",
              engine: "google",
            });
            settings.setEnabledDraft(true);
          }}
        />
      </View>
      {settings.enabled && external ? (
        <View style={styles.searchCredential}>
          <View style={styles.keyCopy}>
            <Key color={colors.ink} size={20} weight="bold" />
            <View style={styles.copy}>
              <Text style={styles.label}>SerpApi key</Text>
              <Text style={styles.description}>
                {settings.searchKey.trim()
                  ? "SerpApi key is configured"
                  : "Add your own SerpApi key"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Configure SerpApi key"
            accessibilityRole="button"
            onPress={() => router.push("/settings/search-api" as Href)}
            style={({ pressed }) => [
              styles.serpApiLink,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.serpApiLinkText}>Configure</Text>
          </Pressable>
        </View>
      ) : null}
      {settings.enabled && !external && !settings.provider.supportsResearch ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings/providers")}
          style={({ pressed }) => [
            styles.providerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.providerButtonText}>
            Choose a searchable AI model
          </Text>
        </Pressable>
      ) : null}
      <Text style={styles.privacyNote}>
        {settings.enabled
          ? "Search applies to new reports. Discuss never searches."
          : "No transcript leaves the app for search."}
      </Text>
      {settings.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Verify and save search choice"
        accessibilityRole="button"
        accessibilityState={{
          busy: settings.saving,
          disabled: settings.saving,
        }}
        disabled={settings.saving}
        onPress={() => void settings.saveCurrent()}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.pressed,
          settings.saving && styles.disabled,
        ]}
      >
        {settings.saving ? (
          <ActivityIndicator color={colors.inkInverse} />
        ) : (
          <Text style={styles.saveButtonText}>Save search choice</Text>
        )}
      </Pressable>
    </SettingsSubpage>
  );
}
function ConsentOption({
  active,
  body,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  body: string;
  disabled: boolean;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityHint={body}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active && styles.optionActive,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, active && styles.activeText]}>
          {label}
        </Text>
        <Text style={[styles.optionBody, active && styles.activeText]}>
          {body}
        </Text>
      </View>
      {active ? <Check color={colors.ink} size={20} weight="bold" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  providerButton: {
    minHeight: 48,
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  providerButtonText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  copy: { flex: 1, gap: 3 },
  label: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 15,
  },
  description: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  options: { gap: 10 },
  searchCredential: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  serpApiLink: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
  },
  serpApiLinkText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  keyCopy: { flex: 1, minWidth: 0, flexDirection: "row", gap: 10 },
  privacyNote: {
    marginTop: 16,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 17,
  },
  option: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  optionActive: { backgroundColor: colors.primary },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 14,
  },
  optionBody: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  activeText: { color: colors.ink },
  message: {
    marginTop: 12,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
  },
  saveButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  saveButtonText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 14,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
