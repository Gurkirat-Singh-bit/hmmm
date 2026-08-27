import { ArrowUpRightIcon as ArrowUpRight, CheckIcon as Check, StarIcon as Star } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CaptureRecord } from '@/features/domain/contracts';
import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaVaultList({ captures, onOpen, onToggleSelected, onToggleStar, selectedIds, selecting }: {
  captures: readonly CaptureRecord[];
  onOpen(id: string): void;
  onToggleSelected(id: string): void;
  onToggleStar(capture: CaptureRecord): void;
  selectedIds: ReadonlySet<string>;
  selecting: boolean;
}) {
  return <View style={styles.list}>{captures.map((capture) => <IdeaVaultRow
    capture={capture}
    key={capture.id}
    onOpen={onOpen}
    onToggleSelected={onToggleSelected}
    onToggleStar={onToggleStar}
    selected={selectedIds.has(capture.id)}
    selecting={selecting}
  />)}</View>;
}

function IdeaVaultRow({ capture, onOpen, onToggleSelected, onToggleStar, selected, selecting }: {
  capture: CaptureRecord;
  onOpen(id: string): void;
  onToggleSelected(id: string): void;
  onToggleStar(capture: CaptureRecord): void;
  selected: boolean;
  selecting: boolean;
}) {
  const status = statusCopy(capture.status);
  return <View style={[styles.row, selected && styles.rowSelected]}>
    <Pressable
      accessibilityLabel={selecting ? `${selected ? 'Deselect' : 'Select'} ${capture.title ?? 'untitled idea'}` : `Open ${capture.title ?? 'untitled idea'}`}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      onPress={() => selecting ? onToggleSelected(capture.id) : onOpen(capture.id)}
      style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
    >
      {selecting ? <View accessibilityElementsHidden style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check color={colors.ink} size={16} weight="bold" /> : null}</View> : null}
      <View style={styles.copy}>
        <View style={styles.titleLine}><Text numberOfLines={2} style={styles.title}>{capture.title?.trim() || 'Untitled idea'}</Text><View style={[styles.statusDot, { backgroundColor: status.color }]} /></View>
        <Text numberOfLines={2} style={styles.summary}>{capture.summary?.trim() || capture.transcript?.text || status.supporting}</Text>
        <Text style={styles.meta}>{status.label} · {formatDate(capture.createdAt)}{capture.kind ? ` · ${capture.kind}` : ''}</Text>
      </View>
      {!selecting ? <View accessibilityElementsHidden style={styles.open}><ArrowUpRight color={colors.inkMuted} size={18} weight="bold" /></View> : null}
    </Pressable>
    {!selecting ? <Pressable
      accessibilityLabel={capture.starred ? `Unstar ${capture.title ?? 'idea'}` : `Star ${capture.title ?? 'idea'}`}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => onToggleStar(capture)}
      style={({ pressed }) => [styles.icon, capture.starred && styles.starred, pressed && styles.pressed]}
    ><Star color={colors.ink} size={19} weight={capture.starred ? 'fill' : 'regular'} /></Pressable> : null}
  </View>;
}

function statusCopy(status: CaptureRecord['status']) {
  if (status === 'ready') return { label: 'Ready', supporting: 'Your report is ready to review.', color: colors.calm };
  if (status === 'failed') return { label: 'Needs attention', supporting: 'Processing stopped. Open for details.', color: colors.danger };
  if (status === 'transcribing') return { label: 'Transcribing', supporting: 'Turning your recording into words.', color: colors.primary };
  if (status === 'naming') return { label: 'Structuring', supporting: 'Turning your words into an idea report.', color: colors.primary };
  if (status === 'researching') return { label: 'Researching', supporting: 'Gathering cited context for your idea.', color: colors.primary };
  return { label: 'Queued', supporting: 'This idea will be structured when processing resumes.', color: colors.primary };
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Saved locally' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 22 },
  row: { minHeight: 106, flexDirection: 'row', alignItems: 'center', borderRadius: radii.large, backgroundColor: colors.canvasSoft },
  rowMain: { flex: 1, minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  rowSelected: { backgroundColor: colors.primarySoft },
  checkbox: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 14, backgroundColor: colors.canvas },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  copy: { flex: 1, gap: 5, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17, lineHeight: 21 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  summary: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 17 },
  meta: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.canvas },
  starred: { backgroundColor: colors.happySoft },
  open: { width: 30, alignItems: 'center' },
  pressed: { opacity: 0.62 },
});
