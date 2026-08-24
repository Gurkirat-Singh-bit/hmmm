/**
 * @file IdeaVaultList.tsx
 * @description Rounded Vault collection panel and idea rows.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowUpRightIcon as ArrowUpRight, StarIcon as Star } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { VaultIdea } from '@/features/vault/vault-preview';

const accents = { cyan: colors.primarySoft, mint: colors.calmSoft, pink: colors.happySoft } as const;
const strongAccents = { cyan: colors.primary, mint: colors.calm, pink: colors.happy } as const;

export function IdeaVaultList({ ideas, onOpen, onToggleStar }: { ideas: readonly VaultIdea[]; onOpen(id: string): void; onToggleStar(id: string): void }) {
  return <View style={styles.list}>{ideas.map((idea) => <Pressable accessibilityRole="button" key={idea.id} onPress={() => onOpen(idea.id)} style={({ pressed }) => [styles.row, { backgroundColor: accents[idea.accent] }, pressed && styles.pressed]}><View style={styles.copy}><Text numberOfLines={2} style={styles.title}>{idea.title}</Text><Text style={styles.meta}>{idea.status === 'processing' ? 'Processing now' : 'Ready'}</Text></View><Pressable accessibilityLabel={idea.starred ? `Unstar ${idea.title}` : `Star ${idea.title}`} hitSlop={8} onPress={(event) => { event.stopPropagation(); onToggleStar(idea.id); }} style={[styles.starButton, idea.starred && { backgroundColor: strongAccents[idea.accent] }]}><Star color={colors.ink} size={17} weight={idea.starred ? 'fill' : 'regular'} /></Pressable><View style={styles.open}><ArrowUpRight color={colors.inkMuted} size={17} weight="bold" /></View></Pressable>)}{ideas.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No ideas found.</Text><Text style={styles.emptyBody}>Try another search or filter.</Text></View> : null}</View>;
}

const styles = StyleSheet.create({
  list: { gap: 9, marginTop: 20 }, row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radii.large }, copy: { flex: 1, gap: 5 }, title: { maxWidth: 245, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16, lineHeight: 19 }, starButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.52)' }, meta: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 }, open: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(28,28,28,0.08)' }, pressed: { opacity: 0.7 },
  empty: { alignItems: 'center', paddingVertical: 34 }, emptyTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16 }, emptyBody: { marginTop: 4, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 11 },
});
