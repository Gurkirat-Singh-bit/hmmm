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
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

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
      settings.enabled && settings.provider.supportsResearch,
      consent,
    );
  const researchSwitchDisabled =
    settings.saving ||
    (!settings.provider.supportsResearch && !settings.enabled);
  return (
    <SettingsSubpage
      supporting="Research is optional and runs directly with the selected AI provider. It never goes through a Hmmmidea server."
      title="Research"
    >
      <View style={styles.notice}>
        <MagnifyingGlass color={colors.ink} size={20} weight="bold" />
        <Text style={styles.noticeText}>
          When a report is generated, Hmmmidea asks the provider to search the
          claims that matter, then saves cited findings with that report
          revision.
        </Text>
      </View>
      <View
        style={[
          styles.provider,
          !settings.provider.supportsResearch && styles.providerUnsupported,
        ]}
      >
        <Text style={styles.providerEyebrow}>CURRENT SEARCH MODEL</Text>
        <Text style={styles.providerTitle}>{settings.provider.label}</Text>
        <Text numberOfLines={2} style={styles.providerModel}>
          {settings.provider.model || "No model selected"}
        </Text>
        <Text style={styles.providerStatus}>
          {settings.provider.supportsResearch
            ? "Web search is available for this setup."
            : "This model cannot search from Hmmmidea."}
        </Text>
        {!settings.provider.supportsResearch ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings/providers")}
            style={({ pressed }) => [
              styles.providerButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.providerButtonText}>Choose a search model</Text>
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
          {researchProviderDescription(
            settings.provider.id,
            settings.provider.model,
          )}
        </Text>
        <Text style={styles.explanationBody}>
          Only new or regenerated reports can research. Source titles, links,
          and cited findings are stored locally with that report revision.
          Discuss never starts a web search.
        </Text>
      </View>
      <Text style={styles.sectionLabel}>GROUNDING CONSENT</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        <ConsentOption
          active={settings.consent === "granted"}
          body="A research request may send a derived query and relevant transcript context to the selected AI provider."
          disabled={settings.saving}
          label="Allow provider-native research"
          onPress={() => choose("granted")}
        />
        <ConsentOption
          active={settings.consent === "denied"}
          body="Reports use the transcript only. No provider-native grounding request is made."
          disabled={settings.saving}
          label="Keep provider-native research off"
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
