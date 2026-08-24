/**
 * @file RecentIdeasPreview.tsx
 * @description Compact recent-ideas preview list for the Home screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowUpRightIcon as ArrowUpRight } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const previewIdeas = ['A calmer morning capture flow', 'Organize research without tabs', 'Make voice notes easier to revisit'] as const;
const cardColors = [colors.happySoft, colors.calmSoft, colors.primarySoft] as const;
export function RecentIdeasPreview({ onSeeAll }: { onSeeAll: () => void }) {
  return <View style={styles.section}><View style={styles.header}><Text style={styles.title}>Recent ideas</Text><Pressable accessibilityRole="button" hitSlop={8} onPress={onSeeAll}><Text style={styles.seeAll}>See all</Text></Pressable></View><View style={styles.list}>{previewIdeas.map((idea, index) => <Pressable accessibilityRole="button" key={idea} style={({ pressed }) => [styles.row, { backgroundColor: cardColors[index] }, pressed && styles.pressed]}><View style={styles.copy}><Text numberOfLines={2} style={styles.idea}>{idea}</Text><Text style={styles.meta}>{index === 0 ? 'Today' : `${index + 1} days ago`}</Text></View><View style={styles.play}><ArrowUpRight color={colors.inkMuted} size={17} weight="bold" /></View></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 28 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18 }, seeAll: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 12 },
  list: { gap: 9, marginTop: 12 }, row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13, borderRadius: radii.large },
  copy: { flex: 1, gap: 4 }, idea: { maxWidth: 240, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16, lineHeight: 19 }, meta: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 9 },
  play: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(28,28,28,0.08)' }, pressed: { opacity: 0.72 },
});
