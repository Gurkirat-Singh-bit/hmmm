/**
 * @file VoiceCapturePanel.tsx
 * @description Stateful recorder presentation prepared for live transcription controls.
 * @author Gurkirat Singh
 * @license MIT
 */

import { CheckIcon as Check, MicrophoneIcon as Microphone, PauseIcon as Pause, PlayIcon as Play, TrashIcon as Trash } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';

type CaptureMode = 'idle' | 'recording' | 'paused';

export function VoiceCapturePanel({ onDelete, onFinish, onPause, onResume, onStart }: { onDelete?: () => void; onFinish?: () => void; onPause?: () => void; onResume?: () => void; onStart?: () => void }) {
  const [mode, setMode] = useState<CaptureMode>('idle');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (mode !== 'recording') return; const timer = setInterval(() => setElapsed((value) => value + 1), 1000); return () => clearInterval(timer); }, [mode]);
  const start = () => { setElapsed(0); setMode('recording'); onStart?.(); };
  const togglePause = () => { if (mode === 'recording') { setMode('paused'); onPause?.(); } else if (mode === 'paused') { setMode('recording'); onResume?.(); } };
  const remove = () => { setElapsed(0); setMode('idle'); onDelete?.(); };
  const finish = () => { setMode('idle'); onFinish?.(); };
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  return <View style={styles.panel}><Pressable accessibilityRole="button" disabled={mode !== 'idle'} onPress={start} style={styles.liveArea}><View style={styles.transcript}><Text style={styles.timer}>{time}</Text><Text numberOfLines={2} style={styles.transcriptText}>{mode === 'idle' ? 'Tap Record and start speaking' : mode === 'paused' ? 'Paused. Your words are safe.' : 'Your words will appear here as you speak'}</Text></View></Pressable><View style={styles.controls}><CaptureControl disabled={mode === 'idle'} icon={Trash} label="Delete" onPress={remove} /><View style={styles.divider} /><CaptureControl disabled={mode === 'idle'} icon={mode === 'paused' ? Play : Pause} label={mode === 'paused' ? 'Resume' : 'Pause'} onPress={togglePause} /><View style={styles.divider} />{mode === 'idle' ? <CaptureControl icon={Microphone} label="Record" onPress={start} /> : <CaptureControl icon={Check} label="Finish" onPress={finish} />}</View></View>;
}

function CaptureControl({ disabled = false, icon: Icon, label, onPress }: { disabled?: boolean; icon: typeof Trash; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.control, disabled && styles.disabled, pressed && styles.pressed]}><View style={styles.controlIcon}><Icon color={colors.ink} size={19} weight="bold" /></View><Text style={styles.controlLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, padding: 7, paddingBottom: 0, overflow: 'hidden', borderRadius: radii.panel, backgroundColor: colors.canvas, shadowColor: '#000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.09, shadowRadius: 18, elevation: 5 },
  liveArea: { height: 196, padding: 17, borderRadius: 25, backgroundColor: colors.primary },
  transcript: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, timer: { color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 42, letterSpacing: -1.5 }, transcriptText: { maxWidth: 280, marginTop: 5, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16, lineHeight: 20, textAlign: 'center' },
  controls: { height: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, control: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }, controlIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.surfaceMuted }, controlLabel: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 }, divider: { width: StyleSheet.hairlineWidth, height: 38, backgroundColor: colors.line }, disabled: { opacity: 0.28 }, pressed: { opacity: 0.65 },
});
