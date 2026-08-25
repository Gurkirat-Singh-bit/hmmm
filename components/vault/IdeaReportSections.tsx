/**
 * @file IdeaReportSections.tsx
 * @description Structured, section-based content for a validated idea report.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowRightIcon as ArrowRight, ChatCircleDotsIcon as Chat } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { IdeaReport } from '@/features/vault/vault-preview';

export function IdeaReportSections({ onDiscuss, report }: { onDiscuss(): void; report: IdeaReport }) {
  return <View style={styles.sections}><ReportCard color={colors.primarySoft} label="THE GIST"><Text style={styles.lead}>{report.gist}</Text></ReportCard><ReportCard color={colors.calmSoft} label="EVIDENCE">{report.evidence.map((item) => <Bullet key={item} text={item} />)}</ReportCard><ReportCard color={colors.happySoft} label="RISK CHECK">{report.risks.map((item) => <Bullet key={item} text={item} />)}</ReportCard><ReportCard color={colors.darkCanvas} dark label="NEXT MOVE"><Text style={styles.next}>{report.nextMove}</Text><ArrowRight color={colors.inkInverse} size={20} weight="bold" /></ReportCard><Pressable accessibilityRole="button" onPress={onDiscuss} style={({ pressed }) => [styles.discuss, pressed && styles.pressed]}><Chat color={colors.ink} size={19} weight="bold" /><Text style={styles.discussText}>Discuss this idea</Text></Pressable></View>;
}

function ReportCard({ children, color, dark = false, label }: { children: React.ReactNode; color: string; dark?: boolean; label: string }) {
  return <View style={[styles.card, { backgroundColor: color }]}><Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>{children}</View>;
}

function Bullet({ text }: { text: string }) {
  return <View style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.body}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  sections: { gap: 12, marginTop: 26 }, card: { gap: 11, padding: 18, borderRadius: radii.large }, label: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1.1 }, labelDark: { color: colors.darkMuted }, lead: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, bullet: { width: 6, height: 6, marginTop: 7, borderRadius: 3, backgroundColor: colors.ink }, body: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 20 }, next: { maxWidth: 290, color: colors.inkInverse, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18, lineHeight: 23 },
  discuss: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: radii.pill, backgroundColor: colors.primary }, discussText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, pressed: { opacity: 0.7 },
});
