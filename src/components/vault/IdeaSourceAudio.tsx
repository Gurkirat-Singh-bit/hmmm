/**
 * @file IdeaSourceAudio.tsx
 * @description Playback controls for retained source audio attached to an idea.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  MicrophoneIcon as Microphone,
  PauseIcon as Pause,
  PlayIcon as Play,
  StopIcon as Stop,
  WarningCircleIcon as Warning,
} from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  AudioAsset,
  NormalizedError,
  PlaybackState,
} from "@/features/domain/contracts";
import { colors, onboardingFonts, radii } from "@/constants/theme";

const bars = [
  8, 13, 9, 18, 12, 22, 15, 27, 18, 30, 14, 24, 19, 28, 12, 21, 16, 26, 18, 23,
  11, 20, 14, 25, 17, 22, 13, 19, 10, 16, 9, 13,
];
export function IdeaSourceAudio({
  audio,
  error,
  onStop,
  onToggle,
  playbackState,
  positionMs,
  durationMs,
  transcript,
}: {
  audio: AudioAsset | null;
  error: NormalizedError | null;
  onStop(): void;
  onToggle(): void;
  playbackState: PlaybackState;
  positionMs: number;
  durationMs: number;
  transcript: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTranscript = Boolean(transcript?.trim());
  const unavailable = !audio;
  const playable = !unavailable && playbackState !== "loading";
  const isPlaying = playbackState === "playing";
  const progress =
    durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Microphone color={colors.primary} size={15} weight="fill" />
        <Text style={styles.label}>Original recording</Text>
        <Text style={styles.time}>{formatTime(durationMs)}</Text>
      </View>
      {unavailable ? (
        <View style={styles.unavailable}>
          <Warning color={colors.inkSecondary} size={17} weight="bold" />
          <Text style={styles.unavailableText}>
            No source audio was retained for this idea.
          </Text>
        </View>
      ) : (
        <View style={styles.player}>
          <Pressable
            accessibilityLabel={
              isPlaying ? "Pause original recording" : "Play original recording"
            }
            accessibilityRole="button"
            accessibilityState={{
              busy: playbackState === "loading",
              disabled: !playable,
            }}
            disabled={!playable}
            onPress={onToggle}
            style={({ pressed }) => [
              styles.play,
              (playbackState === "failed" || !playable) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isPlaying ? (
              <Pause color={colors.ink} size={19} weight="fill" />
            ) : (
              <Play color={colors.ink} size={19} weight="fill" />
            )}
          </Pressable>
          <View style={styles.progress}>
            <View
              accessible
              accessibilityLabel={`${formatTime(positionMs)} of ${formatTime(durationMs)}`}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: Math.max(durationMs, 0),
                now: Math.min(Math.max(positionMs, 0), Math.max(durationMs, 0)),
                text: playbackCopy(playbackState, positionMs, durationMs),
              }}
              style={styles.wave}
            >
              {bars.map((height, index) => (
                <View
                  key={index}
                  style={[
                    styles.bar,
                    {
                      height,
                      opacity: index / bars.length <= progress ? 1 : 0.34,
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              accessibilityLiveRegion="polite"
              style={styles.playbackStatus}
            >
              {playbackCopy(playbackState, positionMs, durationMs)}
            </Text>
          </View>
          {playbackState === "playing" || playbackState === "paused" ? (
            <Pressable
              accessibilityLabel="Stop original recording"
              accessibilityRole="button"
              onPress={onStop}
              style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
            >
              <Stop color={colors.ink} size={17} weight="fill" />
            </Pressable>
          ) : null}
        </View>
      )}
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Warning color={colors.ink} size={15} weight="bold" />
          <Text style={styles.errorText}>
            {error.message || "The saved audio could not be played."}
          </Text>
        </View>
      ) : null}
      {hasTranscript ? (
        <Pressable
          accessibilityLabel={
            expanded
              ? "Collapse original transcript"
              : "Expand original transcript"
          }
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [
            styles.transcriptButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={expanded ? undefined : 2}
            style={styles.transcript}
          >
            “{transcript}”
          </Text>
          <Text style={styles.collapse}>
            {expanded ? "Show less" : "Read original words"}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.noTranscript}>
          An original transcript is not available yet.
        </Text>
      )}
    </View>
  );
}
function playbackCopy(
  state: PlaybackState,
  positionMs: number,
  durationMs: number,
) {
  if (state === "loading") return "Loading audio…";
  if (state === "playing")
    return `Playing ${formatTime(positionMs)} of ${formatTime(durationMs)}`;
  if (state === "paused") return `Paused at ${formatTime(positionMs)}`;
  if (state === "ended") return "Finished. Play again?";
  if (state === "failed") return "Playback needs attention";
  return "Ready to play";
}
function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    marginTop: 24,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.primarySoft,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  time: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 9,
  },
  player: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  stop: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(28,28,28,0.08)",
  },
  progress: { minWidth: 0, flex: 1 },
  wave: {
    height: 34,
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  bar: {
    minWidth: 2,
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  playbackStatus: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 9,
  },
  unavailable: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unavailableText: {
    flex: 1,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
  },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    padding: 9,
    borderRadius: radii.medium,
    backgroundColor: colors.happySoft,
  },
  errorText: {
    flex: 1,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 10,
    lineHeight: 15,
  },
  transcriptButton: { minHeight: 48, justifyContent: "center" },
  transcript: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  collapse: {
    marginTop: 5,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textAlign: "right",
  },
  noTranscript: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.62 },
});
