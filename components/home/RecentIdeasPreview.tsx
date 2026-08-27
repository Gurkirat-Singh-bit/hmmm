/**
 * @file RecentIdeasPreview.tsx
 * @description Compact repository-backed recent-ideas preview list for the Home screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowClockwiseIcon as ArrowClockwise, ArrowUpRightIcon as ArrowUpRight } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { CaptureRecord } from '@/features/domain/contracts';

const cardColors = [colors.happySoft, colors.calmSoft, colors.primarySoft] as const;
export function RecentIdeasPreview({ ideas, onOpen, onRetry, onSeeAll }: { ideas: readonly CaptureRecord[]; onOpen(id: string): void; onRetry(id: string): void; onSeeAll(): void }) {
  return <View style={styles.section}><View style={styles.header}><Text style={styles.title}>Recent ideas</Text><Pressable accessibilityLabel="See all ideas" accessibilityRole="button" hitSlop={8} onPress={onSeeAll} style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}><Text style={styles.seeAll}>See all</Text></Pressable></View><View style={styles.list}>{ideas.length ? ideas.map((idea, index) => <View key={idea.id} style={[styles.row, { backgroundColor: cardColors[index % cardColors.length] }]}><Pressable accessibilityLabel={`Open ${ideaTitle(idea)}`} accessibilityRole="button" onPress={() => onOpen(idea.id)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}><View style={styles.copy}><Text numberOfLines={2} style={styles.idea}>{ideaTitle(idea)}</Text><Text style={styles.meta}>{captureMeta(idea)}</Text></View><View style={styles.openIcon}><ArrowUpRight color={colors.inkMuted} size={17} weight="bold" /></View></Pressable>{idea.status === 'failed' ? <Pressable accessibilityLabel={`Retry ${ideaTitle(idea)}`} accessibilityRole="button" onPress={() => onRetry(idea.id)} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><ArrowClockwise color={colors.ink} size={16} weight="bold" /><Text style={styles.retryText}>Retry</Text></Pressable> : null}</View>) : <Text style={styles.empty}>Your saved voice ideas will appear here.</Text>}</View></View>;
}

function ideaTitle(idea: CaptureRecord) {
  return idea.title?.trim() || idea.transcript?.text.trim().slice(0, 70) || 'Untitled capture';
}

function captureMeta(idea: CaptureRecord) {
  const status = { queued: 'Saved, processing', transcribing: 'Transcribing audio', naming: 'Shaping your idea', researching: 'Researching', ready: 'Ready to review', failed: 'Needs attention' }[idea.status];
  const time = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(idea.createdAt));
  return `${status} · ${time}`;
}

const styles = StyleSheet.create({
  section: { marginTop: 28 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18 }, seeAllButton: { minHeight: 48, justifyContent: 'center' }, seeAll: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 12 },
  list: { gap: 9, marginTop: 12 }, row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderRadius: radii.large }, open: { minHeight: 82, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 18, paddingVertical: 13 },
  copy: { flex: 1, gap: 4 }, idea: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16, lineHeight: 19 }, meta: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 11 },
  openIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(28,28,28,0.08)' }, retry: { minWidth: 58, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2, marginHorizontal: 8, borderRadius: radii.medium, backgroundColor: colors.canvas }, retryText: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 }, empty: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20, paddingVertical: 12 }, pressed: { opacity: 0.72 },
});
