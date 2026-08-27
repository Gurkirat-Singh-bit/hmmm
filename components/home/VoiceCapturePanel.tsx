/**
 * @file VoiceCapturePanel.tsx
 * @description Presentational recorder state machine for the Capture screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import { CheckIcon as Check, MicrophoneIcon as Microphone, PauseIcon as Pause, PlayIcon as Play, TrashIcon as Trash } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { CapturePresentation } from '@/features/captures/contracts';

type VoiceCapturePanelProps = Readonly<{
  capture: CapturePresentation;
  onCancel(): void;
  onFinish(): void;
  onPause(): void;
  onResume(): void;
  onStart(): void;
  onRetry(): void;
}>;

export function VoiceCapturePanel({ capture, onCancel, onFinish, onPause, onResume, onRetry, onStart }: VoiceCapturePanelProps) {
  const active = capture.phase === 'recording' || capture.phase === 'paused';
  const busy = capture.phase === 'starting' || capture.phase === 'saving';
  const primary = primaryAction(capture);
  const time = formatDuration(capture.elapsedMs);
  return (
    <View style={styles.panel}>
      <View style={[styles.liveArea, capture.phase === 'failure' && styles.failureArea]}>
        <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.stateLabel}>{stateLabel(capture.phase)}</Text>
        <Text style={styles.timer}>{time}</Text>
        <Text accessibilityLiveRegion={capture.phase === 'failure' ? 'assertive' : capture.message ? 'polite' : 'none'} style={styles.transcriptText}>{captureCopy(capture)}</Text>
      </View>
      <View style={styles.controls}>
        <CaptureControl disabled={!active || busy} icon={Trash} label="Discard" onPress={onCancel} />
        <View style={styles.divider} />
        <CaptureControl
          disabled={capture.phase !== 'recording' && capture.phase !== 'paused'}
          icon={capture.phase === 'paused' ? Play : Pause}
          label={capture.phase === 'paused' ? 'Resume' : 'Pause'}
          onPress={capture.phase === 'paused' ? onResume : onPause}
        />
        <View style={styles.divider} />
        <CaptureControl
          disabled={busy}
          icon={primary.icon}
          label={primary.label}
          onPress={primary.kind === 'finish' ? onFinish : primary.kind === 'retry' ? onRetry : onStart}
        />
      </View>
    </View>
  );
}

function primaryAction(capture: CapturePresentation) {
  if (capture.phase === 'recording' || capture.phase === 'paused') return { icon: Check, label: 'Finish', kind: 'finish' as const };
  if (capture.phase === 'failure' && capture.canRetry) return { icon: Play, label: 'Try again', kind: 'retry' as const };
  return { icon: Microphone, label: capture.phase === 'permission' ? 'Allow mic' : 'Record', kind: 'start' as const };
}

function stateLabel(phase: CapturePresentation['phase']) {
  return {
    idle: 'Ready when you are', permission: 'Microphone access', starting: 'Starting securely', recording: 'Listening',
    paused: 'Paused', saving: 'Saving safely', queued: 'Saved', failure: 'Capture needs attention',
  }[phase];
}

function captureCopy(capture: CapturePresentation) {
  if (capture.message) return capture.message;
  if (capture.transcript) return capture.transcript;
  if (capture.phase === 'idle') return 'Tap Record and start speaking.';
  if (capture.phase === 'permission') return 'Allow microphone access to capture with your voice.';
  if (capture.phase === 'starting') return 'Preparing a private local recording.';
  if (capture.phase === 'paused') return 'Paused. Your captured audio is still safe on this device.';
  if (capture.phase === 'saving') return 'Protecting the original audio before processing it.';
  if (capture.phase === 'queued') return 'Saved on this device. We will organize it in the background.';
  if (capture.phase === 'failure') return 'This recording could not continue. You can try again.';
  return capture.transcriptMode === 'live'
    ? 'Listening for your words…'
    : 'Your audio will be transcribed after you finish.';
}

function formatDuration(durationMs: number) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function CaptureControl({ disabled = false, icon: Icon, label, onPress }: { disabled?: boolean; icon: typeof Trash; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.control, disabled && styles.disabled, pressed && styles.pressed]}><View style={styles.controlIcon}><Icon color={colors.ink} size={20} weight="bold" /></View><Text style={styles.controlLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, overflow: 'hidden', borderRadius: radii.panel, backgroundColor: colors.canvas, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  liveArea: { minHeight: 202, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 20, borderRadius: radii.large, backgroundColor: colors.primary },
  failureArea: { backgroundColor: colors.happySoft }, stateLabel: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 }, timer: { marginTop: 4, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 42, letterSpacing: -1.5 }, transcriptText: { maxWidth: 290, marginTop: 8, color: colors.ink, fontFamily: onboardingFonts.bodyMedium, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  controls: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, control: { minHeight: 64, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }, controlIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceMuted }, controlLabel: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11 }, divider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: colors.line }, disabled: { opacity: 0.3 }, pressed: { opacity: 0.65 },
});
