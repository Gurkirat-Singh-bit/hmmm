/**
 * @file research.tsx
 * @description Settings route for research consent and provider-grounding preferences.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CheckIcon as Check,
  MagnifyingGlassIcon as MagnifyingGlass,
} from "phosphor-react-native";
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
import { researchProviderDescription } from "@/features/provider/config";
import { useResearchSettings } from "@/features/settings/use-research-settings";

/** Renders provider research availability, behavior, and explicit consent controls. */
export default function ResearchSettingsScreen() {
  const router = useRouter();
  const settings = useResearchSettings();
  const choose = (consent: "granted" | "denied") =>
    void settings.save(
      consent === "granted" && settings.enabled && settings.sourceReady,
      consent,
    );
  const researchSwitchDisabled =
    settings.saving || (!settings.sourceReady && !settings.enabled);
  const external = settings.source.kind === "external";
  return (
    <SettingsSubpage
      supporting="Choose AI-native search or SerpApi. Requests go directly from your device, never through a Hmmmidea server."
      title="Research"
    >
      <View style={styles.notice}>
        <MagnifyingGlass color={colors.ink} size={20} weight="bold" />
        <Text style={styles.noticeText}>
          Research is explicit. Hmmmidea never switches search providers after a
          failure, and your saved capture remains on this device.
        </Text>
      </View>
      <Text style={styles.sectionLabel}>SEARCH SOURCE</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        <ConsentOption
          active={!external}
          body="Uses the selected AI model's native search tools. Only supported models can enable it."
          disabled={settings.saving}
          label="AI-native search"
          onPress={() => settings.setSource({ kind: "ai-native" })}
        />
        <ConsentOption
          active={external}
          body="Plans one Google query, then gives selected snippets and links to your AI provider."
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
          <Text style={styles.retention}>
            SerpApi says standard searches may be retained for 31 days.
            ZeroTrace is available only on Enterprise plans.
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.provider,
          !settings.sourceReady && styles.providerUnsupported,
        ]}
      >
        <Text style={styles.providerEyebrow}>CURRENT RESEARCH PATH</Text>
        <Text style={styles.providerTitle}>
          {external ? "SerpApi · Google" : settings.provider.label}
        </Text>
        <Text numberOfLines={2} style={styles.providerModel}>
          {external
            ? `Query planner: ${settings.provider.model || "No model selected"}`
            : settings.provider.model || "No model selected"}
        </Text>
        <Text style={styles.providerStatus}>
          {settings.sourceReady
            ? "Research is available for this setup."
            : external
              ? "Add a SerpApi key to enable research."
              : "This model cannot use native search from Hmmmidea."}
        </Text>
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
              Choose a native-search model
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.label}>Use optional research</Text>
          <Text style={styles.description}>
            Applies to new reports and regenerated revisions. Existing reports
            do not change automatically.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Use optional research"
          accessibilityState={{
            busy: settings.saving,
            disabled: researchSwitchDisabled,
          }}
          disabled={researchSwitchDisabled}
          onValueChange={(enabled) => void settings.setEnabled(enabled)}
          trackColor={{ false: colors.lineStrong, true: colors.primary }}
          value={settings.enabled}
        />
      </View>
      <Text style={styles.sectionLabel}>HOW THIS SETUP SEARCHES</Text>
      <View style={styles.explanation}>
        <Text style={styles.explanationTitle}>
          {settings.provider.label} · {settings.provider.model || "No model"}
        </Text>
        <Text style={styles.explanationBody}>
          {external
            ? "The selected AI model creates one query without web tools. SerpApi runs one Google search with SafeSearch active and cached results allowed."
            : researchProviderDescription(
                settings.provider.id,
                settings.provider.model,
              )}
        </Text>
        <Text style={styles.explanationBody}>
          {external
            ? "Only the derived query goes to SerpApi. Up to six selected titles, snippets, and links are then sent to your configured AI provider and stored with the report revision."
            : "Only new or regenerated reports can research. Source titles, links, and cited findings are stored locally with that report revision."}{" "}
          Discuss never starts a web search.
        </Text>
      </View>
      <Text style={styles.sectionLabel}>RESEARCH CONSENT</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        <ConsentOption
          active={settings.consent === "granted"}
          body={
            external
              ? "Allow a derived query to go to SerpApi and selected snippets and links to go to the AI provider."
              : "Allow relevant transcript context to go to the AI provider's native search tools."
          }
          disabled={settings.saving}
          label="Allow researched reports"
          onPress={() => choose("granted")}
        />
        <ConsentOption
          active={settings.consent === "denied"}
          body="Reports use the transcript only. No search request is made."
          disabled={settings.saving}
          label="Keep research off"
          onPress={() => choose("denied")}
        />
      </View>
      {settings.consent === "unknown" ? (
        <Text accessibilityRole="alert" style={styles.pending}>
          Choose an option before a research request can run.
        </Text>
      ) : null}
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
          <Text style={styles.saveButtonText}>Verify and save research</Text>
        )}
      </Pressable>
      <Text style={styles.afterward}>
        After enabling research, return to an idea and regenerate its report.
        Discuss remains grounded in the saved idea and does not silently browse.
      </Text>
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
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.happySoft,
  },
  noticeText: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  provider: {
    gap: 4,
    marginTop: 14,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.calmSoft,
  },
  providerUnsupported: { backgroundColor: colors.surfaceMuted },
  providerEyebrow: {
    marginBottom: 3,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  providerTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 17,
  },
  providerModel: {
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  providerStatus: {
    marginTop: 3,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
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
  retention: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 17,
  },
  explanation: {
    gap: 7,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  explanationTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 14,
  },
  explanationBody: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
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
  pending: {
    marginTop: 12,
    color: colors.danger,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
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
  afterward: {
    marginTop: 18,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
