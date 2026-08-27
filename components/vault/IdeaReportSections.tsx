import { ArrowsClockwiseIcon as Regenerate, CaretRightIcon as CaretRight, ChatCircleDotsIcon as Discuss, FloppyDiskIcon as Save, PencilSimpleIcon as Edit, WarningCircleIcon as Warning } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CaptureRecord, ReportContent, ReportRecord, ReportRevision, SourceRecord } from '@/features/domain/contracts';
import { colors, onboardingFonts, radii } from '@/constants/theme';

export function IdeaReportSections({ capture, onDiscuss, onOpenCitation, onRegenerate, onSaveManual, onSelectRevision, regenerating, report, revisions, sources }: {
  capture: CaptureRecord;
  onDiscuss(): void;
  onOpenCitation(url: string, domain: string): Promise<void>;
  onRegenerate(): void;
  onSaveManual(content: ReportContent): Promise<void>;
  onSelectRevision(revision: ReportRevision | null): void;
  regenerating: boolean;
  report: ReportRecord | null;
  revisions: readonly ReportRecord[];
  sources: readonly SourceRecord[];
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const isActive = report?.revision === capture.activeReportRevision;
  const isOutdated = Boolean(report && !isActive && (report.phase === 'final' || capture.transcript?.phase === 'final'));
  const outdatedProvisional = Boolean(report?.phase === 'provisional'
    && capture.activeReportRevision === null
    && capture.transcript?.phase === 'final'
    && report.transcriptRevision !== capture.transcript.revision);
  const canRegenerate = capture.transcript?.phase === 'final';
  const editable = Boolean(report && report.phase === 'final' && isActive && capture.transcript?.phase === 'final');
  const openCitation = async (url: string, domain: string) => {
    setNotice(null);
    try {
      await onOpenCitation(url, domain);
    } catch {
      setNotice('That citation could not be opened safely.');
    }
  };

  return <View style={styles.wrap}>
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    <ReportHistory activeRevision={capture.activeReportRevision} onSelect={onSelectRevision} report={report} revisions={revisions} />
    {!report ? <ProcessingState capture={capture} onRegenerate={onRegenerate} regenerating={regenerating} /> : null}
    {report ? <>
      {capture.status === 'failed' ? <FailureState canRegenerate={canRegenerate} capture={capture} onRegenerate={onRegenerate} regenerating={regenerating} /> : null}
      {report.phase === 'provisional' ? <View style={[styles.provisional, isOutdated && styles.outdated]}><Text style={styles.provisionalTitle}>{isOutdated ? 'This provisional draft is outdated.' : 'A provisional report is available.'}</Text><Text style={styles.provisionalBody}>{isOutdated ? 'Your final transcript is saved. This earlier draft stays available for reference until you explicitly generate a final report.' : 'It may change while processing continues. Your original words remain unchanged.'}</Text>{outdatedProvisional ? <Pressable accessibilityRole="button" onPress={onRegenerate} style={({ pressed }) => [styles.retry, pressed && styles.pressed, regenerating && styles.disabled]} disabled={regenerating}><Regenerate color={colors.inkInverse} size={17} weight="bold" /><Text style={styles.retryText}>{regenerating ? 'Queuing…' : 'Generate final report'}</Text></Pressable> : null}</View> : null}
      {isOutdated && report.phase === 'final' ? <View style={styles.outdated}><Text style={styles.provisionalTitle}>You are viewing an older report.</Text><Text style={styles.provisionalBody}>This immutable revision is kept for reference. Return to the current report to edit or regenerate.</Text></View> : null}
      <View style={styles.revisionLine}><Text style={styles.revision}>Revision {report.revision}</Text><Text style={styles.provenance}>{isActive ? 'Current report' : isOutdated ? 'Outdated snapshot' : 'Historical snapshot'}</Text></View>
      <Section title="The gist" provenance={report.provenance.gist}><Text style={styles.paragraph}>{report.content.gist}</Text></Section>
      <Section title="Evidence" provenance={report.provenance.evidence}>
        {report.content.evidence.length ? report.content.evidence.map((item) => <Text key={item.id} style={styles.bullet}>• {item.text}</Text>) : <Text style={styles.muted}>No research evidence was added to this report.</Text>}
        {sources.length ? <View style={styles.sources}><Text style={styles.sourceHeading}>Sources</Text>{sources.map((source) => <Pressable accessibilityRole="link" key={source.id} onPress={() => void openCitation(source.url, source.domain)} style={({ pressed }) => [styles.source, pressed && styles.pressed]}><Text numberOfLines={1} style={styles.sourceText}>{source.title || source.domain}</Text><CaretRight color={colors.inkMuted} size={16} weight="bold" /></Pressable>)}</View> : null}
      </Section>
      <Section title="Risk check" provenance={report.provenance.risks}>{report.content.risks.length ? report.content.risks.map((risk, index) => <Text key={`${risk}-${index}`} style={styles.bullet}>• {risk}</Text>) : <Text style={styles.muted}>No risks were added.</Text>}</Section>
      <Section title="Next move" provenance={report.provenance.nextMove}><Text style={styles.paragraph}>{report.content.nextMove}</Text></Section>
      {report.content.verdict ? <Section title="Verdict" provenance={report.provenance.verdict}><Text style={styles.paragraph}>{report.content.verdict}</Text></Section> : null}
      {editable ? <ManualEditor key={report.revision} onSave={onSaveManual} report={report} /> : null}
      {!editable && report.phase === 'final' ? <Text style={styles.locked}>Historical revisions are read-only. Return to the current report to make a new revision.</Text> : null}
      <Pressable accessibilityRole="button" disabled={capture.status !== 'ready'} onPress={onDiscuss} style={({ pressed }) => [styles.discuss, capture.status !== 'ready' && styles.disabled, pressed && styles.pressed]}><Discuss color={colors.inkInverse} size={20} weight="fill" /><Text style={styles.discussText}>Discuss this idea</Text></Pressable>
    </> : null}
  </View>;
}

function ReportHistory({ activeRevision, onSelect, report, revisions }: { activeRevision: number | null; onSelect(revision: number | null): void; report: ReportRecord | null; revisions: readonly ReportRecord[] }) {
  if (!revisions.length) return null;
  return <View style={styles.history}><Text style={styles.historyTitle}>Report history</Text><View accessibilityLabel="Report revisions" accessibilityRole="radiogroup" style={styles.historyOptions}>{revisions.map((revision) => <Pressable accessibilityLabel={`Report revision ${revision.revision}${revision.revision === activeRevision ? ', current report' : ', historical report'}`} accessibilityRole="radio" accessibilityState={{ checked: report?.revision === revision.revision }} key={revision.revision} onPress={() => onSelect(revision.revision === activeRevision ? null : revision.revision)} style={({ pressed }) => [styles.historyButton, report?.revision === revision.revision && styles.historyButtonActive, pressed && styles.pressed]}><Text style={styles.historyButtonText}>R{revision.revision}{revision.revision === activeRevision ? ' · Current' : ''}</Text></Pressable>)}</View></View>;
}

function ProcessingState({ capture, onRegenerate, regenerating }: { capture: CaptureRecord; onRegenerate(): void; regenerating: boolean }) {
  const failed = capture.status === 'failed';
  return <View style={[styles.state, failed && styles.failed]}><Warning color={colors.ink} size={22} weight="bold" /><View style={styles.stateCopy}><Text style={styles.stateTitle}>{failed ? 'Processing stopped.' : 'This idea is still taking shape.'}</Text><Text style={styles.stateBody}>{failed ? capture.error?.message || 'Your recording and original words are safe. Try generating the report again.' : 'You can leave this screen. The saved capture will update when its local job completes.'}</Text>{failed && capture.transcript?.phase === 'final' ? <Pressable accessibilityRole="button" disabled={regenerating} onPress={onRegenerate} style={({ pressed }) => [styles.retry, pressed && styles.pressed, regenerating && styles.disabled]}><Text style={styles.retryText}>{regenerating ? 'Queuing…' : 'Try again'}</Text></Pressable> : null}</View></View>;
}

function FailureState({ canRegenerate, capture, onRegenerate, regenerating }: { canRegenerate: boolean; capture: CaptureRecord; onRegenerate(): void; regenerating: boolean }) {
  return <View style={[styles.state, styles.failed]}><Warning color={colors.ink} size={20} weight="bold" /><View style={styles.stateCopy}><Text style={styles.stateTitle}>The latest processing attempt needs attention.</Text><Text style={styles.stateBody}>{capture.error?.message || 'Your previous report is still available below.'}</Text>{canRegenerate ? <Pressable accessibilityRole="button" disabled={regenerating} onPress={onRegenerate} style={({ pressed }) => [styles.retry, pressed && styles.pressed, regenerating && styles.disabled]}><Text style={styles.retryText}>{regenerating ? 'Queuing…' : 'Regenerate report'}</Text></Pressable> : null}</View></View>;
}

function Section({ children, provenance, title }: { children: ReactNode; provenance: ReportRecord['provenance']['gist']; title: string }) {
  return <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text><Text style={styles.byline}>{provenanceLabel(provenance)}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

function provenanceLabel(provenance: ReportRecord['provenance']['gist']) {
  if (provenance.owner === 'user') return provenance.origin === 'discussion-update' ? 'Applied by you from a discussion' : 'Edited by you';
  return 'Generated by your AI provider';
}

function ManualEditor({ onSave, report }: { onSave(content: ReportContent): Promise<void>; report: ReportRecord }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gist, setGist] = useState(report.content.gist);
  const [evidence, setEvidence] = useState(report.content.evidence.map((item) => item.text).join('\n'));
  const [risks, setRisks] = useState(report.content.risks.join('\n'));
  const [nextMove, setNextMove] = useState(report.content.nextMove);
  const [verdict, setVerdict] = useState(report.content.verdict ?? '');

  useEffect(() => {
    setEditing(false); setError(null); setGist(report.content.gist); setEvidence(report.content.evidence.map((item) => item.text).join('\n')); setRisks(report.content.risks.join('\n')); setNextMove(report.content.nextMove); setVerdict(report.content.verdict ?? '');
  }, [report]);

  const save = async () => {
    const nextEvidence = evidence.split('\n').map((text) => text.trim()).filter(Boolean).map((text, index) => {
      const previous = report.content.evidence.find((item) => item.text === text);
      return previous ?? { id: `manual-evidence-${Date.now()}-${index}`, text, sourceIds: [] };
    });
    const content: ReportContent = {
      gist: gist.trim(),
      evidence: nextEvidence,
      risks: risks.split('\n').map((risk) => risk.trim()).filter(Boolean),
      nextMove: nextMove.trim(),
      verdict: verdict.trim() || null,
    };
    if (!content.gist || !content.nextMove) return setError('The gist and next move cannot be empty.');
    setSaving(true); setError(null);
    try {
      await onSave(content);
      setEditing(false);
    } catch {
      setError('The report changed before this update could be saved. Review the current revision and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) return <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Edit color={colors.ink} size={19} weight="bold" /><Text style={styles.editText}>Edit as a new revision</Text></Pressable>;
  return <View style={styles.editor}>
    <Text style={styles.editorTitle}>Create a new revision</Text><Text style={styles.editorBody}>Your current report remains unchanged. This update will be saved as a separate revision owned by you.</Text>
    <Field label="The gist" onChangeText={setGist} value={gist} /><Field label="Evidence, one point per line" multiline onChangeText={setEvidence} value={evidence} /><Field label="Risk check, one point per line" multiline onChangeText={setRisks} value={risks} /><Field label="Next move" onChangeText={setNextMove} value={nextMove} /><Field label="Verdict, optional" multiline onChangeText={setVerdict} value={verdict} />
    {error ? <Text accessibilityLiveRegion="polite" style={styles.editorError}>{error}</Text> : null}
    <View style={styles.editorActions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => setEditing(false)} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, saving && styles.disabled, pressed && styles.pressed]}><Save color={colors.inkInverse} size={18} weight="bold" /><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save revision'}</Text></Pressable></View>
  </View>;
}

function Field({ label, multiline = false, onChangeText, value }: { label: string; multiline?: boolean; onChangeText(value: string): void; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} multiline={multiline} onChangeText={onChangeText} placeholderTextColor={colors.inkMuted} style={[styles.input, multiline && styles.inputMultiline]} value={value} /></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 18, marginTop: 24 },
  notice: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12, lineHeight: 18 },
  history: { gap: 8, padding: 14, borderRadius: radii.medium, backgroundColor: colors.surfaceMuted },
  historyTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  historyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: colors.canvas },
  historyButtonActive: { backgroundColor: colors.primary },
  historyButtonText: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11 },
  state: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 16, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  failed: { backgroundColor: colors.happySoft },
  stateCopy: { flex: 1, gap: 4 },
  stateTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 },
  stateBody: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center', gap: 7, marginTop: 6, paddingHorizontal: 15, borderRadius: radii.pill, backgroundColor: colors.ink },
  retryText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  provisional: { padding: 15, borderRadius: radii.medium, backgroundColor: colors.primarySoft },
  outdated: { backgroundColor: colors.happySoft },
  provisionalTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  provisionalBody: { marginTop: 4, color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  revisionLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revision: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  provenance: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11 },
  section: { gap: 6 },
  sectionTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 22, lineHeight: 27 },
  byline: { color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 },
  sectionBody: { gap: 8, paddingTop: 3 },
  paragraph: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  bullet: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  muted: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  sources: { gap: 5, marginTop: 5 },
  sourceHeading: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  source: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: radii.medium, backgroundColor: colors.surfaceMuted },
  sourceText: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 },
  edit: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  editText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  locked: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  discuss: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.pill, backgroundColor: colors.ink },
  discussText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 },
  editor: { gap: 14, padding: 16, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  editorTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 20 },
  editorBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radii.medium, backgroundColor: colors.canvas, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 14 },
  inputMultiline: { minHeight: 82, paddingVertical: 12, textAlignVertical: 'top' },
  editorError: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12, lineHeight: 17 },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  cancelText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  save: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15, borderRadius: radii.pill, backgroundColor: colors.ink },
  saveText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.62 },
});
