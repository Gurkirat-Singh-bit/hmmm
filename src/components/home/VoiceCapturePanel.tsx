/**
 * @file VoiceCapturePanel.tsx
 * @description Presentational recorder state machine for the Capture screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CheckIcon as Check,
  MicrophoneIcon as Microphone,
  PauseIcon as Pause,
  PlayIcon as Play,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { CapturePresentation } from "@/features/capture/state";

type VoiceCapturePanelProps = Readonly<{
  capture: CapturePresentation;
  onCancel(): void;
  onFinish(): void;
  onPause(): void;
  onResume(): void;
  onStart(): void;
  onRetry(): void;
}>;
export function VoiceCapturePanel({
  capture,
  onCancel,
  onFinish,
  onPause,
  onResume,
  onRetry,
  onStart,
}: VoiceCapturePanelProps) {
  const active = capture.phase === "recording" || capture.phase === "paused";
  const busy = capture.phase === "starting" || capture.phase === "saving";
  const primary = primaryAction(capture);
  const time = formatDuration(capture.elapsedMs);
  return (
    <View style={styles.panel}>
      <View
        style={[
          styles.liveArea,
          capture.phase === "failure" && styles.failureArea,
        ]}
      >
        <Text style={styles.timer}>{time}</Text>
        <LiveCaption
          assertive={capture.phase === "failure"}
          live={
            capture.transcriptMode === "live" &&
            Boolean(capture.transcript) &&
            capture.phase === "recording"
          }
          text={captureCopy(capture)}
        />
        {capture.transcript && capture.message ? (
          <Text accessibilityLiveRegion="polite" style={styles.liveStatus}>
            {capture.message}
          </Text>
        ) : null}
      </View>
      <View style={styles.controls}>
        <CaptureControl
          disabled={!active || busy}
          icon={Trash}
          label="Discard"
          onPress={onCancel}
        />
        <View style={styles.divider} />
        <CaptureControl
          disabled={capture.phase !== "recording" && capture.phase !== "paused"}
          icon={capture.phase === "paused" ? Play : Pause}
          label={capture.phase === "paused" ? "Resume" : "Pause"}
          onPress={capture.phase === "paused" ? onResume : onPause}
        />
        <View style={styles.divider} />
        <CaptureControl
          disabled={busy}
          icon={primary.icon}
          label={primary.label}
          onPress={
            primary.kind === "finish"
              ? onFinish
              : primary.kind === "retry"
                ? onRetry
                : onStart
          }
        />
      </View>
    </View>
  );
}
function LiveCaption({
  assertive,
  live,
  text,
}: {
  assertive: boolean;
  live: boolean;
  text: string;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const lines = liveCaptionLines(text);
  useEffect(() => {
    if (!live) return;
    opacity.setValue(0.35);
    Animated.timing(opacity, {
      duration: 220,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [live, opacity, text]);
  return (
    <View
      accessibilityLiveRegion={
        assertive ? "assertive" : live ? "polite" : "none"
      }
      style={styles.captionViewport}
    >
      {live && lines.previous ? (
        <Text
          ellipsizeMode="clip"
          numberOfLines={1}
          style={[styles.transcriptText, styles.previousWords]}
        >
          {lines.previous}
        </Text>
      ) : null}
      <Animated.Text
        ellipsizeMode="clip"
        numberOfLines={live ? 2 : 4}
        style={[styles.transcriptText, live && { opacity }]}
      >
        {live ? lines.latest : text}
      </Animated.Text>
    </View>
  );
}
function liveCaptionLines(text: string) {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  const latestStart = Math.max(0, words.length - 10);
  const previousStart = Math.max(0, latestStart - 8);
  return {
    previous: words.slice(previousStart, latestStart).join(" "),
    latest: words.slice(latestStart).join(" "),
  };
}
function primaryAction(capture: CapturePresentation) {
  if (capture.phase === "recording" || capture.phase === "paused")
    return { icon: Check, label: "Finish", kind: "finish" as const };
  if (capture.phase === "failure" && capture.canRetry)
    return { icon: Play, label: "Try again", kind: "retry" as const };
  return {
    icon: Microphone,
    label: capture.phase === "permission" ? "Allow mic" : "Record",
    kind: "start" as const,
  };
}
function captureCopy(capture: CapturePresentation) {
  if (capture.phase === "failure" && capture.message) return capture.message;
  if (capture.transcript) return capture.transcript;
  if (capture.message) return capture.message;
  if (capture.phase === "idle") return "Tap Record and start speaking.";
  if (capture.phase === "permission")
    return "Allow microphone access to capture with your voice.";
  if (capture.phase === "starting")
    return "Preparing a private local recording.";
  if (capture.phase === "paused")
    return "Paused. Your captured audio is still safe on this device.";
  if (capture.phase === "saving")
    return "Protecting the original audio before processing it.";
  if (capture.phase === "queued")
    return "Saved on this device. We will organize it in the background.";
  if (capture.phase === "failure")
    return "This recording could not continue. You can try again.";
  return capture.transcriptMode === "live"
    ? "Listening for your words…"
    : "Your audio will be transcribed after you finish.";
}
function formatDuration(durationMs: number) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function CaptureControl({
  disabled = false,
  icon: Icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: typeof Trash;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.controlIcon}>
        <Icon color={colors.ink} size={20} weight="bold" />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    padding: 7,
    paddingBottom: 0,
    overflow: "hidden",
    borderRadius: radii.panel,
    backgroundColor: colors.canvas,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  liveArea: {
    height: 196,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 17,
    borderRadius: 25,
    backgroundColor: colors.primary,
  },
  failureArea: { backgroundColor: colors.happySoft },
  timer: {
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 42,
    letterSpacing: -1.5,
  },
  captionViewport: {
    width: "100%",
    height: 66,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
    overflow: "hidden",
  },
  transcriptText: {
    maxWidth: 280,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
  },
  previousWords: {
    marginBottom: 2,
    opacity: 0.32,
    fontSize: 12,
    lineHeight: 16,
  },
  liveStatus: {
    maxWidth: 280,
    marginTop: 7,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  controls: {
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  control: {
    minHeight: 64,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  controlIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
  },
  controlLabel: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 10,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    backgroundColor: colors.line,
  },
  disabled: { opacity: 0.28 },
  pressed: { opacity: 0.65 },
});
