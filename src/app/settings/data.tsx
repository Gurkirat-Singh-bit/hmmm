/**
 * @file data.tsx
 * @description Settings route for deleting local ideas or resetting every on-device record and credential.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  TrashIcon as Trash,
  WarningCircleIcon as Warning,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";

import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { deleteAllIdeas, fullReset } from "@/features/settings/data-management";
export default function DataSettingsScreen() {
  const router = useRouter();
  const [working, setWorking] = useState<"ideas" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const removeIdeas = () =>
    Alert.alert(
      "Delete all ideas?",
      "This deletes every capture, report, discussion, queued job, and retained source-audio file. Provider settings and API credentials stay on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete ideas",
          style: "destructive",
          onPress: () => void run("ideas"),
        },
      ],
    );
  const reset = () =>
    Alert.alert(
      "Reset Hmmmidea?",
      "This deletes all ideas and audio, SQLite preferences, and every versioned provider credential. You will set up Hmmmidea again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset app",
          style: "destructive",
          onPress: () => void run("reset"),
        },
      ],
    );
  const run = async (kind: "ideas" | "reset") => {
    setWorking(kind);
    setMessage(null);
    try {
      const receipt =
        kind === "ideas" ? await deleteAllIdeas() : await fullReset();
      const audio = [
        receipt.pendingAudioUris.length
          ? `${receipt.pendingAudioUris.length} source-audio file${receipt.pendingAudioUris.length === 1 ? "" : "s"} remain queued for cleanup.`
          : "",
        receipt.failedAudioUris.length
          ? `${receipt.failedAudioUris.length} source-audio file${receipt.failedAudioUris.length === 1 ? "" : "s"} could not be removed and need another cleanup attempt.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      const secure =
        receipt.secureData === "failed"
          ? " Protected credentials could not be fully cleared. Run full reset again."
          : "";
      setMessage(
        kind === "ideas"
          ? `All idea records were deleted.${audio ? ` ${audio}` : ""}`
          : receipt.secureData === "deleted"
            ? `Hmmmidea was reset.${audio ? ` ${audio}` : ""}`
            : `Structured data was deleted, but the reset is incomplete.${secure}${audio ? ` ${audio}` : ""}`,
      );
      if (kind === "reset" && receipt.secureData === "deleted")
        router.replace("/onboarding");
    } catch {
      setMessage(
        "The deletion could not finish. No credential or idea details were exposed. Try again.",
      );
    } finally {
      setWorking(null);
    }
  };
  return (
    <SettingsSubpage
      supporting="Source audio is always retained with an idea until you delete that idea or reset the app."
      title="Data controls"
    >
      <View style={styles.notice}>
        <Warning color={colors.ink} size={20} weight="bold" />
        <Text style={styles.noticeText}>
          Choose the scope carefully. Deleting ideas leaves your preferences and
          protected keys in place. Reset removes them too.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Delete all ideas</Text>
        <Text style={styles.body}>
          Deletes captures, transcripts, reports, discussions, durable jobs, and
          referenced source audio. Your language, research choice, notification
          preference, providers, and credentials remain.
        </Text>
        <ActionButton
          destructive
          label="Delete all ideas"
          loading={working === "ideas"}
          onPress={removeIdeas}
        />
      </View>
      <View style={[styles.card, styles.resetCard]}>
        <Text style={styles.title}>Full reset</Text>
        <Text style={styles.body}>
          Deletes all ideas and audio, SQLite preferences, migration metadata,
          and every versioned speech and AI credential slot. Hmmmidea returns to
          setup.
        </Text>
        <ActionButton
          destructive
          label="Reset Hmmmidea"
          loading={working === "reset"}
          onPress={reset}
        />
      </View>
      {message ? (
        <Text accessibilityLiveRegion="assertive" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
function ActionButton({
  destructive,
  label,
  loading,
  onPress,
}: {
  destructive: boolean;
  label: string;
  loading: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructive,
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.inkInverse} />
      ) : (
        <>
          <Trash color={colors.inkInverse} size={18} weight="bold" />
          <Text style={styles.buttonText}>{label}</Text>
        </>
      )}
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
  card: {
    gap: 8,
    marginTop: 14,
    padding: 18,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  resetCard: { backgroundColor: colors.surfaceMuted },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
  },
  body: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    borderRadius: radii.medium,
    backgroundColor: colors.ink,
  },
  destructive: { backgroundColor: colors.ink },
  buttonText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 13,
  },
  message: {
    marginTop: 14,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
