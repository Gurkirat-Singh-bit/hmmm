import { ArrowsClockwiseIcon as Regenerate, CheckIcon as Check } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReportField, ReportRecord, ReportRevision } from '@/features/domain/contracts';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const labels: Readonly<Record<ReportField, string>> = {
  gist: 'The gist',
  evidence: 'Evidence',
  risks: 'Risk check',
  nextMove: 'Next move',
  verdict: 'Verdict',
};
const fields: readonly ReportField[] = ['gist', 'evidence', 'risks', 'nextMove', 'verdict'];

export function RegenerationControl({ expectedActiveRevision, onCancel, onConfirm, open, regenerating, report }: {
  expectedActiveRevision: ReportRevision | null;
  onCancel(): void;
  onConfirm(expectedActiveRevision: ReportRevision | null, replaceUserFields: readonly ReportField[]): Promise<void>;
  open: boolean;
  regenerating: boolean;
  report: ReportRecord | null;
}) {
  const [selected, setSelected] = useState<Set<ReportField>>(() => new Set());
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, report?.revision]);
  if (!open) return null;
  const userFields = report ? fields.filter((field) => report.provenance[field].owner === 'user') : [];
  const toggle = (field: ReportField) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    return next;
  });
  return <View style={styles.panel}>
    <Text style={styles.title}>Regenerate report</Text>
    <Text style={styles.body}>{userFields.length ? 'Your edits stay protected unless you deliberately select them below.' : 'The AI will create a fresh revision from the original words.'}</Text>
    {userFields.length ? <View style={styles.fields}>{userFields.map((field) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(field) }} key={field} onPress={() => toggle(field)} style={({ pressed }) => [styles.field, selected.has(field) && styles.fieldSelected, pressed && styles.pressed]}><View style={[styles.checkbox, selected.has(field) && styles.checkboxSelected]}>{selected.has(field) ? <Check color={colors.ink} size={15} weight="bold" /> : null}</View><View style={styles.fieldCopy}><Text style={styles.fieldTitle}>Replace {labels[field]}</Text><Text style={styles.fieldBody}>Allow the regenerated report to replace this edit.</Text></View></Pressable>)}</View> : null}
    <View style={styles.actions}><Pressable accessibilityRole="button" disabled={regenerating} onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={regenerating} onPress={() => void onConfirm(expectedActiveRevision, [...selected])} style={({ pressed }) => [styles.confirm, regenerating && styles.disabled, pressed && styles.pressed]}><Regenerate color={colors.inkInverse} size={18} weight="bold" /><Text style={styles.confirmText}>{regenerating ? 'Queuing…' : selected.size ? 'Confirm replacement' : 'Confirm regeneration'}</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 12, marginTop: 18, padding: 16, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 21 },
  body: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  fields: { gap: 8, marginTop: 2 },
  field: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: radii.medium, backgroundColor: colors.canvas },
  fieldSelected: { backgroundColor: colors.happySoft },
  checkbox: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 13, backgroundColor: colors.canvas },
  checkboxSelected: { borderColor: colors.happy, backgroundColor: colors.happy },
  fieldCopy: { flex: 1, gap: 2 },
  fieldTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  fieldBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 11, lineHeight: 15 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  cancelText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  confirm: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15, borderRadius: radii.pill, backgroundColor: colors.ink },
  confirmText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.62 },
});
