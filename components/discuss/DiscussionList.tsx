import { ChatCircleTextIcon as ChatCircleText, WarningCircleIcon as Warning } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts } from '@/constants/theme';
import type { CaptureRecord, NormalizedError } from '@/features/domain/contracts';
import type { DiscussionThreadSummary } from '@/features/discussion/discussion-service';

export function DiscussionList({ captures, error, loading, onOpen, onRetry, threads }: {
  captures: readonly CaptureRecord[];
  error: NormalizedError | null;
  loading: boolean;
  onOpen(ideaId: string): void;
  onRetry(): void;
  threads: readonly DiscussionThreadSummary[];
}) {
  if (loading) return <View accessibilityLabel="Loading discussions" style={styles.loading}><View style={styles.skeleton} /><View style={styles.skeleton} /><View style={styles.skeleton} /></View>;
  if (error) return <RecoveryPanel body={error.message || 'Your saved conversations remain on this device. Try loading them again.'} onRetry={onRetry} title="Discuss could not load." />;
  return <View style={styles.sections}>
    <View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Continue Discussion</Text>
      {threads.length ? <View style={styles.threadList}>{threads.map((thread) => <ThreadRow key={thread.captureId} onOpen={onOpen} thread={thread} />)}</View> : <EmptyPanel body="Start with a ready idea below. Its conversation will appear here." title="No conversations yet." />}
    </View>
    <View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Start from an idea</Text>
      {captures.length ? <View style={styles.ideaList}>{captures.map((capture) => <IdeaRow capture={capture} key={capture.id} onOpen={onOpen} />)}</View> : <EmptyPanel body="Once a capture finishes processing, you can ask about it here." title="No ready ideas yet." />}
    </View>
  </View>;
}

function ThreadRow({ onOpen, thread }: { onOpen(ideaId: string): void; thread: DiscussionThreadSummary }) {
  return <Pressable accessibilityHint="Opens this idea conversation" accessibilityLabel={`${thread.title}, updated ${relativeTime(thread.updatedAt)}`} accessibilityRole="button" onPress={() => onOpen(thread.captureId)} style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}>
    <View style={styles.copy}><View style={styles.titleLine}><Text style={styles.rowTitle}>{thread.title}</Text><Text style={styles.time}>{relativeTime(thread.updatedAt)}</Text></View><Text style={styles.preview}>{thread.preview}</Text></View>
  </Pressable>;
}

function IdeaRow({ capture, onOpen }: { capture: CaptureRecord; onOpen(id: string): void }) {
  const title = capture.title?.trim() || 'Untitled idea';
  return <Pressable accessibilityHint="Opens a conversation about this saved idea" accessibilityLabel={`Discuss ${title}`} accessibilityRole="button" onPress={() => onOpen(capture.id)} style={({ pressed }) => [styles.ideaRow, pressed && styles.pressed]}>
    <View accessibilityElementsHidden style={styles.ideaIcon}><ChatCircleText color={colors.ink} size={21} weight="bold" /></View>
    <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.preview}>{capture.summary?.trim() || capture.transcript?.text || 'Open the report, then ask what you want to explore.'}</Text></View>
  </Pressable>;
}

function EmptyPanel({ body, title }: { body: string; title: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function RecoveryPanel({ body, onRetry, title }: { body: string; onRetry(): void; title: string }) {
  return <View style={styles.recovery}><View style={styles.recoveryIcon}><Warning color={colors.ink} size={24} weight="bold" /></View><Text style={styles.recoveryTitle}>{title}</Text><Text style={styles.recoveryBody}>{body}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Try again</Text></Pressable></View>;
}

function relativeTime(timestamp: string) {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Saved';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  sections: { gap: 30 },
  loading: { gap: 10, marginTop: 16 },
  skeleton: { height: 86, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  sectionTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 21, letterSpacing: -0.35 },
  threadList: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  threadRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  copy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 15, lineHeight: 19 },
  time: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 10 },
  preview: { marginTop: 3, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 17 },
  ideaList: { gap: 8, marginTop: 12 },
  ideaRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.canvasSoft },
  ideaIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primarySoft },
  empty: { marginTop: 14, padding: 18, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 },
  emptyBody: { marginTop: 5, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  recovery: { alignItems: 'center', marginTop: 22, padding: 24, borderRadius: 24, backgroundColor: colors.surfaceMuted },
  recoveryIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.happySoft },
  recoveryTitle: { marginTop: 13, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 20 },
  recoveryBody: { marginTop: 6, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', marginTop: 18, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.ink },
  retryText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
