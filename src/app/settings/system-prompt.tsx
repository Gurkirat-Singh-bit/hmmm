/**
 * @file system-prompt.tsx
 * @description Settings route for editing the report-generation instructions.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CheckCircleIcon as CheckCircle,
  LockSimpleIcon as LockSimple,
} from "phosphor-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { SYSTEM_PROMPT_LIMITS } from "@/features/provider/config";
import { useSystemPrompt } from "@/features/settings/use-system-prompt";

/** Renders the editable report prompt while keeping the output contract locked. */
export default function SystemPromptSettingsScreen() {
  const settings = useSystemPrompt();
  const remaining = SYSTEM_PROMPT_LIMITS.maxCharacters - settings.prompt.length;

  return (
    <SettingsSubpage
      supporting="Change how Hmmmidea turns a transcript into an idea report. The report structure and citation rules stay protected."
      title="System prompt"
    >
      <View style={styles.contract}>
        <LockSimple color={colors.ink} size={20} weight="bold" />
        <View style={styles.contractCopy}>
          <Text style={styles.contractTitle}>Format contract is locked</Text>
          <Text style={styles.contractBody}>
            Hmmmidea always validates the title, summary, gist, evidence, risks,
            next move, and verdict fields before a report can be displayed.
          </Text>
        </View>
      </View>

      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.label}>REPORT INSTRUCTIONS</Text>
          <Text style={styles.mode}>
            {settings.isCustom ? "Using your prompt" : "Using built-in prompt"}
          </Text>
        </View>
        <Text style={[styles.count, remaining < 300 && styles.countLow]}>
          {remaining.toLocaleString()} left
        </Text>
      </View>

      {settings.loading ? (
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.loadingText}>Loading prompt…</Text>
        </View>
      ) : (
        <TextInput
          accessibilityHint="These instructions change report tone and content, but cannot change the required report fields."
          accessibilityLabel="Report system prompt"
          autoCapitalize="sentences"
          autoCorrect
          maxLength={SYSTEM_PROMPT_LIMITS.maxCharacters}
          multiline
          onChangeText={settings.setPrompt}
          placeholder="Describe how an idea report should be written."
          placeholderTextColor={colors.inkMuted}
          scrollEnabled
          style={styles.editor}
          textAlignVertical="top"
          value={settings.prompt}
        />
      )}

      {settings.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          busy: settings.saving,
          disabled: settings.loading,
        }}
        disabled={settings.loading || settings.saving}
        onPress={() => void settings.save()}
        style={({ pressed }) => [
          styles.save,
          pressed && styles.pressed,
          (settings.loading || settings.saving) && styles.disabled,
        ]}
      >
        <CheckCircle color={colors.inkInverse} size={19} weight="bold" />
        <Text style={styles.saveText}>
          {settings.saving ? "Saving…" : "Save prompt"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityHint="Removes your local override."
        accessibilityRole="button"
        disabled={settings.loading || settings.saving || !settings.isCustom}
        onPress={() => void settings.restore()}
        style={({ pressed }) => [
          styles.restore,
          pressed && styles.pressed,
          (settings.loading || settings.saving || !settings.isCustom) &&
            styles.disabled,
        ]}
      >
        <Text style={styles.restoreText}>Restore built-in prompt</Text>
      </Pressable>

      <Text style={styles.note}>
        Saved locally in SQLite. It is sent only to your selected AI provider
        when Hmmmidea creates a new report or report revision.
      </Text>
    </SettingsSubpage>
  );
}

const styles = StyleSheet.create({
  contract: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.happySoft,
  },
  contractCopy: { flex: 1, gap: 4 },
  contractTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 14,
  },
  contractBody: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 9,
  },
  label: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  mode: {
    marginTop: 3,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
  },
  count: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 11,
  },
  countLow: { color: colors.danger },
  editor: {
    minHeight: 280,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },
  loading: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  loadingText: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
  },
  message: {
    marginTop: 10,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  save: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    borderRadius: radii.medium,
    backgroundColor: colors.ink,
  },
  saveText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 14,
  },
  restore: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  restoreText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  note: {
    marginTop: 12,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.48 },
});
