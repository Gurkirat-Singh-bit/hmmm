/**
 * @file research.tsx
 * @description Settings route for research consent and provider-grounding preferences.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CheckIcon as Check,
} from "phosphor-react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { SecretField } from "@/components/onboarding/OnboardingFields";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { SERPAPI_MANAGE_KEY_URL } from "@/features/provider/config";
import { useResearchSettings } from "@/features/settings/use-research-settings";

/** Renders provider research availability, behavior, and explicit consent controls. */
export default function ResearchSettingsScreen() {
  const router = useRouter();
  const settings = useResearchSettings();
  const external = settings.source.kind === "external";
  return (
    <SettingsSubpage
      supporting="Add current sources to new idea reports."
      title="Research"
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.label}>Search for report sources</Text>
          <Text style={styles.description}>Off uses only your transcript.</Text>
        </View>
        <Switch
          accessibilityLabel="Search for report sources"
          accessibilityState={{
            busy: settings.saving,
            disabled: settings.saving,
          }}
          disabled={settings.saving}
          onValueChange={(enabled) => void settings.setEnabled(enabled)}
          trackColor={{ false: colors.lineStrong, true: colors.primary }}
          value={settings.enabled}
        />
      </View>
      <Text style={styles.sectionLabel}>SOURCE</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        <ConsentOption
          active={!external}
          body={`${settings.provider.label} · ${settings.provider.model || "No model"}`}
          disabled={settings.saving}
          label="AI search"
          onPress={() => settings.setSource({ kind: "ai-native" })}
        />
        <ConsentOption
          active={external}
          body="Google results with your own key"
          disabled={settings.saving}
          label="SerpApi"
          onPress={() =>
            settings.setSource({
              kind: "external",
              providerId: "serpapi",
              engine: "google",
            })
          }
        />
      </View>
      {external ? (
        <View style={styles.searchCredential}>
          <SecretField
            attempted={settings.enabled && !settings.searchKey.trim()}
            label="SERPAPI KEY"
            light
            onChangeText={settings.setSearchKey}
            placeholder="Paste SerpApi key"
            value={settings.searchKey}
          />
          <Pressable
            accessibilityHint="Opens the official SerpApi account page"
            accessibilityLabel="Get a SerpApi key"
            accessibilityRole="link"
            onPress={() =>
              void Linking.openURL(SERPAPI_MANAGE_KEY_URL).catch(
                () => undefined,
              )
            }
            style={({ pressed }) => [
              styles.serpApiLink,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.serpApiLinkText}>Get a SerpApi key</Text>
            <ArrowSquareOut color={colors.ink} size={17} weight="bold" />
          </Pressable>
          <Text style={styles.retention}>
            SerpApi may retain standard searches for 31 days.
          </Text>
        </View>
      ) : null}
      {!external && !settings.provider.supportsResearch ? (
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
        {external
          ? `One derived query goes to SerpApi. Up to six result snippets and links go to ${settings.provider.label}.`
          : `Relevant idea context goes to ${settings.provider.label}, which performs the search.`}{" "}
        New and regenerated reports only. Discuss never searches, and failures
        never switch providers.
      </Text>
      {settings.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Verify and save research settings"
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
          <Text style={styles.saveButtonText}>Save research settings</Text>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
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
  sectionLabel: {
    marginTop: 24,
    marginBottom: 8,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  options: { gap: 10 },
  searchCredential: {
    gap: 8,
    marginTop: 12,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  serpApiLink: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
  },
  serpApiLinkText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  retention: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 17,
  },
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
