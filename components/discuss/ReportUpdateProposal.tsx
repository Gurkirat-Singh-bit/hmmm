/**
 * @file ReportUpdateProposal.tsx
 * @description Explicit confirmation UI for a proposed idea report change.
 * @author Gurkirat Singh
 * @license MIT
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { ReportUpdateProposal as ReportUpdateProposalModel } from '@/features/discussion/discussion-preview';

export type ProposalDecision = 'pending' | 'applied' | 'kept';

export function ReportUpdateProposal({ decision, onApply, onKeep, proposal }: { decision: ProposalDecision; onApply(): void; onKeep(): void; proposal: ReportUpdateProposalModel }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>IDEA UPDATE</Text>
      <Text style={styles.title}>Update the next move?</Text>
      <Text style={styles.proposed}>{proposal.proposed}</Text>
      {decision === 'pending' ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onApply} style={({ pressed }) => [styles.apply, pressed && styles.pressed]}><Text style={styles.applyText}>Update idea</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onKeep} style={({ pressed }) => [styles.keep, pressed && styles.pressed]}><Text style={styles.keepText}>Keep in chat</Text></Pressable>
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" style={[styles.decision, decision === 'applied' && styles.decisionApplied]}>
          <Text style={[styles.decisionText, decision === 'applied' && styles.decisionTextApplied]}>{decision === 'applied' ? 'Idea updated' : 'Kept in chat'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: radii.large, backgroundColor: colors.calmSoft },
  eyebrow: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  title: { marginTop: 3, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16 },
  proposed: { marginTop: 10, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  apply: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.ink },
  applyText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  keep: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill, backgroundColor: colors.canvas },
  keepText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  decision: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill, backgroundColor: colors.canvas },
  decisionApplied: { borderColor: colors.ink, backgroundColor: colors.ink },
  decisionText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  decisionTextApplied: { color: colors.inkInverse },
  pressed: { opacity: 0.7 },
});
