import { CaretDownIcon as CaretDown, MicrophoneIcon as Microphone, PauseIcon as Pause, PlayIcon as Play, WarningCircleIcon as Warning } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioAsset, NormalizedError, PlaybackState } from '@/features/domain/contracts';
import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaSourceAudio({ audio, error, onToggle, playbackState, positionMs, durationMs, transcript }: {
  audio: AudioAsset | null;
  error: NormalizedError | null;
  onToggle(): void;
  playbackState: PlaybackState;
  positionMs: number;
  durationMs: number;
  transcript: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTranscript = Boolean(transcript?.trim());
  const unavailable = !audio;
  const playable = !unavailable && playbackState !== 'loading';
  const isPlaying = playbackState === 'playing';
  const progress = durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;
  return <View style={styles.card}>
    <View style={styles.header}><Microphone color={colors.ink} size={17} weight="fill" /><Text style={styles.label}>Original recording</Text><Text style={styles.time}>{formatTime(durationMs)}</Text></View>
    {unavailable ? <View style={styles.unavailable}><Warning color={colors.inkSecondary} size={18} weight="bold" /><Text style={styles.unavailableText}>No source audio was retained for this idea.</Text></View> : <View style={styles.player}>
      <Pressable accessibilityLabel={isPlaying ? 'Pause original recording' : 'Play original recording'} accessibilityRole="button" disabled={!playable} onPress={onToggle} style={({ pressed }) => [styles.play, (playbackState === 'failed' || !playable) && styles.disabled, pressed && styles.pressed]}>{isPlaying ? <Pause color={colors.ink} size={19} weight="fill" /> : <Play color={colors.ink} size={19} weight="fill" />}</Pressable>
      <View
        accessible
        accessibilityLabel="Original recording playback position"
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: Math.max(durationMs, 0),
          now: Math.min(Math.max(positionMs, 0), Math.max(durationMs, 0)),
          text: `${formatTime(positionMs)} of ${formatTime(durationMs)}`,
        }}
        style={styles.timeline}
      ><View style={styles.track}><View style={[styles.progress, { width: `${progress}%` }]} /></View><Text accessible={false} style={styles.position}>{formatTime(positionMs)} / {formatTime(durationMs)}</Text></View>
    </View>}
    {error ? <View accessibilityLiveRegion="polite" style={styles.error}><Warning color={colors.ink} size={16} weight="bold" /><Text style={styles.errorText}>{error.message || 'The saved audio could not be played.'}</Text></View> : null}
    {hasTranscript ? <Pressable accessibilityLabel={expanded ? 'Collapse original words' : 'Expand original words'} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.transcriptButton, pressed && styles.pressed]}>
      <Text numberOfLines={expanded ? undefined : 3} style={styles.transcript}>“{transcript}”</Text>
      <View style={styles.expand}><Text style={styles.expandLabel}>{expanded ? 'Show less' : 'Read original words'}</Text><CaretDown color={colors.inkMuted} size={16} style={expanded ? styles.rotated : undefined} weight="bold" /></View>
    </Pressable> : <Text style={styles.noTranscript}>An original transcript is not available yet.</Text>}
  </View>;
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: { gap: 13, marginTop: 24, padding: 16, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  time: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primary },
  timeline: { flex: 1, gap: 7 },
  track: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(28,28,28,0.13)' },
  progress: { height: '100%', borderRadius: 4, backgroundColor: colors.ink },
  position: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 },
  unavailable: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: radii.medium, backgroundColor: colors.canvas },
  unavailableText: { flex: 1, color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12, lineHeight: 17 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: radii.medium, backgroundColor: colors.happySoft },
  errorText: { flex: 1, color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11, lineHeight: 16 },
  transcriptButton: { gap: 8, paddingTop: 2 },
  transcript: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  expand: { minHeight: 40, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  expandLabel: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  rotated: { transform: [{ rotate: '180deg' }] },
  noTranscript: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.62 },
});
