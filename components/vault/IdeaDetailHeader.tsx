import { ArrowLeftIcon as ArrowLeft, ArrowsClockwiseIcon as Regenerate, FilePdfIcon as FilePdf, ShareNetworkIcon as Share, StarIcon as Star } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CaptureRecord, ReportRecord } from '@/features/domain/contracts';
import { colors, onboardingFonts } from '@/constants/theme';

export function IdeaDetailHeader({ capture, onRegenerate, onShare, onSharePdf, onToggleStar, regenerating, report, sharingPdf }: {
  capture: CaptureRecord;
  onRegenerate(): void;
  onShare(): void;
  onSharePdf(): void;
  onToggleStar(): void;
  regenerating: boolean;
  report: ReportRecord | null;
  sharingPdf: boolean;
}) {
  const router = useRouter();
  const status = statusText(capture.status);
  const outdatedProvisional = report?.phase === 'provisional'
    && capture.activeReportRevision === null
    && capture.transcript?.phase === 'final'
    && report.transcriptRevision !== capture.transcript.revision;
  const canRegenerate = capture.transcript?.phase === 'final'
    && (capture.status === 'ready' || capture.status === 'failed' || outdatedProvisional);
  return <View>
    <View style={styles.actions}>
      <Pressable accessibilityLabel="Back to Vault" accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/vault')} style={({ pressed }) => [styles.circle, pressed && styles.pressed]}><ArrowLeft color={colors.ink} size={21} weight="bold" /></Pressable>
      <View style={styles.trailing}>
        <Pressable accessibilityLabel={capture.starred ? 'Remove star' : 'Star idea'} accessibilityRole="button" onPress={onToggleStar} style={({ pressed }) => [styles.circle, capture.starred && styles.starred, pressed && styles.pressed]}><Star color={colors.ink} size={19} weight={capture.starred ? 'fill' : 'regular'} /></Pressable>
        <Pressable accessibilityLabel="Regenerate report" accessibilityRole="button" disabled={regenerating || !canRegenerate} onPress={onRegenerate} style={({ pressed }) => [styles.circle, (regenerating || !canRegenerate) && styles.disabled, pressed && styles.pressed]}><Regenerate color={colors.ink} size={19} weight="bold" /></Pressable>
        <Pressable accessibilityLabel="Share idea as text" accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.circle, pressed && styles.pressed]}><Share color={colors.ink} size={19} weight="bold" /></Pressable>
        {report ? <Pressable accessibilityLabel={report.phase === 'provisional' ? 'Share provisional report as PDF' : 'Share report as PDF'} accessibilityRole="button" accessibilityState={{ busy: sharingPdf, disabled: sharingPdf }} disabled={sharingPdf} onPress={onSharePdf} style={({ pressed }) => [styles.circle, styles.pdf, sharingPdf && styles.disabled, pressed && styles.pressed]}>{sharingPdf ? <ActivityIndicator accessibilityLabel="Preparing PDF" color={colors.ink} size="small" /> : <FilePdf color={colors.ink} size={19} weight="bold" />}</Pressable> : null}
      </View>
    </View>
    <Text style={styles.kicker}>IDEA REPORT</Text>
    <Text accessibilityRole="header" style={styles.title}>{capture.title?.trim() || 'Untitled idea'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.meta}>{status} · Saved locally</Text>
  </View>;
}

function statusText(status: CaptureRecord['status']) {
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Needs attention';
  if (status === 'researching') return 'Researching';
  if (status === 'naming') return 'Structuring';
  if (status === 'transcribing') return 'Transcribing';
  return 'Queued';
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trailing: { flexDirection: 'row', gap: 8 },
  circle: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 24, backgroundColor: colors.canvas },
  starred: { borderColor: colors.happy, backgroundColor: colors.happySoft },
  pdf: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  kicker: { marginTop: 25, color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.15 },
  title: { maxWidth: 350, marginTop: 7, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.7 },
  meta: { marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12 },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.4 },
});
