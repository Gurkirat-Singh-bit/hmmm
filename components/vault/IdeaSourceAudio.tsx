/**
 * @file IdeaSourceAudio.tsx
 * @description Compact source recording player with expandable transcription support.
 * @author Gurkirat Singh
 * @license MIT
 */

import { MicrophoneIcon as Microphone, PauseIcon as Pause, PlayIcon as Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const duration = 54;
const bars = [8, 13, 9, 18, 12, 22, 15, 27, 18, 30, 14, 24, 19, 28, 12, 21, 16, 26, 18, 23, 11, 20, 14, 25, 17, 22, 13, 19, 10, 16, 9, 13];

export function IdeaSourceAudio({ accentColor, surfaceColor, transcript }: { accentColor: string; surfaceColor: string; transcript: string }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!playing) return; const timer = setInterval(() => setElapsed((value) => value >= duration ? 0 : value + 1), 1000); return () => clearInterval(timer); }, [playing]);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={[styles.card, { backgroundColor: surfaceColor }]}><View style={styles.header}><Microphone color={accentColor} size={15} weight="fill" /><Text style={styles.label}>Original recording</Text><Text style={styles.time}>0:{String(duration).padStart(2, '0')}</Text></View><View style={styles.player}><Pressable accessibilityLabel={playing ? 'Pause recording' : 'Play recording'} accessibilityRole="button" onPress={(event) => { event.stopPropagation(); setPlaying((value) => !value); }} style={[styles.play, { backgroundColor: accentColor }]}>{playing ? <Pause color={colors.ink} size={17} weight="fill" /> : <Play color={colors.ink} size={17} weight="fill" />}</Pressable><View style={styles.wave}>{bars.map((height, index) => <View key={index} style={[styles.bar, { backgroundColor: accentColor, height, opacity: index / bars.length <= elapsed / duration ? 1 : 0.34 }]} />)}</View></View><Text numberOfLines={expanded ? undefined : 2} style={styles.transcript}>“{transcript}”</Text>{expanded ? <Text style={styles.collapse}>Tap to collapse transcript</Text> : null}</Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: 12, marginTop: 24, padding: 16, borderRadius: radii.large }, header: { flexDirection: 'row', alignItems: 'center', gap: 7 }, label: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 }, time: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 9 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10 }, play: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }, wave: { height: 34, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 }, bar: { width: 2.5, borderRadius: 2 },
  transcript: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 11, lineHeight: 16 }, collapse: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 8, letterSpacing: 0.5, textAlign: 'right' },
});
