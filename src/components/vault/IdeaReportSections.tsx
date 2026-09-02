/**
 * @file IdeaReportSections.tsx
 * @description Sectioned rendering for the active structured idea report.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowsClockwiseIcon as Regenerate,
  CaretDownIcon as CaretDown,
  CaretRightIcon as CaretRight,
  CaretUpIcon as CaretUp,
  ChatCircleDotsIcon as Discuss,
  FilePdfIcon as FilePdf,
  FloppyDiskIcon as Save,
  PencilSimpleIcon as Edit,
  MagnifyingGlassIcon as MagnifyingGlass,
  WarningCircleIcon as Warning,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import type {
  CaptureRecord,
  ReportContent,
  ReportRecord,
  ReportRevision,
  SourceRecord,
} from "@/features/domain/contracts";
import type { JobRecord } from "@/features/jobs/contracts";
export function IdeaReportSections({
  capture,
  jobs,
  onDiscuss,
  onOpenCitation,
  onRegenerate,
  onResearchSettings,
  onSaveManual,
  onSelectRevision,
  onSharePdf,
  regenerating,
  report,
  revisions,
  sharingPdf,
  sources,
}: {
  capture: CaptureRecord;
  jobs: readonly JobRecord[];
  onDiscuss(): void;
  onOpenCitation(url: string, domain: string): Promise<void>;
  onRegenerate(): void;
  onResearchSettings(): void;
  onSaveManual(content: ReportContent): Promise<void>;
  onSelectRevision(revision: ReportRevision | null): void;
  onSharePdf(): void;
  regenerating: boolean;
  report: ReportRecord | null;
  revisions: readonly ReportRecord[];
  sharingPdf: boolean;
  sources: readonly SourceRecord[];
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const isActive = report?.revision === capture.activeReportRevision;
  const isOutdated = Boolean(
    report &&
    !isActive &&
    (report.phase === "final" || capture.transcript?.phase === "final"),
  );
  const outdatedProvisional = Boolean(
    report?.phase === "provisional" &&
    capture.activeReportRevision === null &&
    capture.transcript?.phase === "final" &&
    report.transcriptRevision !== capture.transcript.revision,
  );
  const canRegenerate = capture.transcript?.phase === "final";
  const editable = Boolean(
    report &&
    report.phase === "final" &&
    isActive &&
    capture.transcript?.phase === "final",
  );
  const canDiscuss =
    capture.status === "ready" || capture.activeReportRevision !== null;
  const openCitation = async (url: string, domain: string) => {
    setNotice(null);
    try {
      await onOpenCitation(url, domain);
    } catch {
      setNotice("That citation could not be opened safely.");
    }
  };

  return (
    <View style={styles.wrap}>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <ReportHistory
        activeRevision={capture.activeReportRevision}
        onSelect={onSelectRevision}
        report={report}
        revisions={revisions}
      />
      {capture.status !== "ready" &&
      (capture.status !== "failed" || !report) ? (
        <ProcessingState
          capture={capture}
          jobs={jobs}
          onRegenerate={onRegenerate}
          regenerating={regenerating}
        />
      ) : null}
      {report ? (
        <>
          {capture.status === "failed" ? (
            <FailureState
              canRegenerate={canRegenerate}
              capture={capture}
              onRegenerate={onRegenerate}
              regenerating={regenerating}
            />
          ) : null}
          {report.phase === "provisional" ? (
            <View style={[styles.provisional, isOutdated && styles.outdated]}>
              <Text style={styles.provisionalTitle}>
                {isOutdated
                  ? "This provisional draft is outdated."
                  : "A provisional report is available."}
              </Text>
              <Text style={styles.provisionalBody}>
                {isOutdated
                  ? "Your final transcript is saved. This earlier draft stays available until you generate a final report."
                  : "It may change while processing continues. Your original words remain unchanged."}
              </Text>
              {outdatedProvisional ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={regenerating}
                  onPress={onRegenerate}
                  style={({ pressed }) => [
                    styles.retry,
                    regenerating && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Regenerate
                    color={colors.inkInverse}
                    size={17}
                    weight="bold"
                  />
                  <Text style={styles.retryText}>
                    {regenerating ? "Queuing…" : "Generate final report"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {isOutdated && report.phase === "final" ? (
            <Text style={styles.historicalNotice}>
              Viewing an older report. Choose Current above to return.
            </Text>
          ) : null}
          <ReportBody
            editable={editable}
            onOpenCitation={openCitation}
            onRegenerate={onRegenerate}
            onResearchSettings={onResearchSettings}
            onSave={onSaveManual}
            onSharePdf={onSharePdf}
            regenerating={regenerating}
            report={report}
            sharingPdf={sharingPdf}
            sources={sources}
          />
          {!editable && report.phase === "final" ? (
            <Text style={styles.locked}>Historical reports are read-only.</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDiscuss }}
            disabled={!canDiscuss}
            onPress={onDiscuss}
            style={({ pressed }) => [
              styles.discuss,
              !canDiscuss && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Discuss color={colors.ink} size={20} weight="fill" />
            <Text style={styles.discussText}>Discuss this idea</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
function ReportHistory({
  activeRevision,
  onSelect,
  report,
  revisions,
}: {
  activeRevision: number | null;
  onSelect(revision: number | null): void;
  report: ReportRecord | null;
  revisions: readonly ReportRecord[];
}) {
  if (revisions.length < 2) return null;
  return (
    <View style={styles.history}>
      <Text style={styles.historyTitle}>Report history</Text>
      <View
        accessibilityLabel="Report revisions"
        accessibilityRole="radiogroup"
        style={styles.historyOptions}
      >
        {revisions.map((revision) => {
          const current = revision.revision === activeRevision;
          const selected = report?.revision === revision.revision;
          return (
            <Pressable
              accessibilityLabel={
                current
                  ? "Current report"
                  : `Report revision ${revision.revision}`
              }
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={revision.revision}
              onPress={() => onSelect(current ? null : revision.revision)}
              style={({ pressed }) => [
                styles.historyButton,
                selected && styles.historyButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.historyButtonText}>
                {current ? "Current" : `Revision ${revision.revision}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function ProcessingState({
  capture,
  jobs,
  onRegenerate,
  regenerating,
}: {
  capture: CaptureRecord;
  jobs: readonly JobRecord[];
  onRegenerate(): void;
  regenerating: boolean;
}) {
  const failed = capture.status === "failed";
  const status = processingStatus(capture, jobs);
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      style={[styles.state, failed && styles.failed]}
    >
      <Warning color={colors.ink} size={22} weight="bold" />
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>
          {failed ? "Processing stopped." : status.title}
        </Text>
        <Text style={styles.stateBody}>
          {failed
            ? capture.error?.message ||
              "Your recording and original words are safe. Try generating the report again."
            : status.body}
        </Text>
        {failed && capture.transcript?.phase === "final" ? (
          <Pressable
            accessibilityRole="button"
            disabled={regenerating}
            onPress={onRegenerate}
            style={({ pressed }) => [
              styles.retry,
              regenerating && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>
              {regenerating ? "Queuing…" : "Try again"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function processingStatus(capture: CaptureRecord, jobs: readonly JobRecord[]) {
  const job = [...jobs]
    .filter(
      (candidate) =>
        candidate.status !== "succeeded" && candidate.status !== "cancelled",
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const title =
    capture.status === "transcribing"
      ? "Transcribing your recording."
      : capture.status === "researching"
        ? "Researching your idea."
        : capture.status === "naming"
          ? "Structuring your report."
          : "Queued to process.";
  if (!job || job.status === "queued") {
    return {
      title,
      body: "Saved on this device and waiting to start. Keep Hmmmidea open so processing can continue.",
    };
  }
  if (job.status === "running") {
    return {
      title,
      body: `Provider request in progress, attempt ${job.attempts} of ${job.maxAttempts}. Last activity ${formatStatusTime(job.updatedAt)}.`,
    };
  }
  if (job.status === "retry-wait") {
    return {
      title: "Waiting to retry.",
      body: `Attempt ${job.attempts} of ${job.maxAttempts} did not finish. The next retry is scheduled for ${formatStatusTime(job.runAfter)} while Hmmmidea is open.`,
    };
  }
  return {
    title,
    body: job.lastError?.message || "The saved job needs attention.",
  };
}
function formatStatusTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
function FailureState({
  canRegenerate,
  capture,
  onRegenerate,
  regenerating,
}: {
  canRegenerate: boolean;
  capture: CaptureRecord;
  onRegenerate(): void;
  regenerating: boolean;
}) {
  return (
    <View style={[styles.state, styles.failed]}>
      <Warning color={colors.ink} size={20} weight="bold" />
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>
          The latest processing attempt needs attention.
        </Text>
        <Text style={styles.stateBody}>
          {capture.error?.message ||
            "Your previous report is still available below."}
        </Text>
        {canRegenerate ? (
          <Pressable
            accessibilityRole="button"
            disabled={regenerating}
            onPress={onRegenerate}
            style={({ pressed }) => [
              styles.retry,
              regenerating && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>
              {regenerating ? "Queuing…" : "Regenerate report"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function ReportBody({
  editable,
  onOpenCitation,
  onRegenerate,
  onResearchSettings,
  onSave,
  onSharePdf,
  regenerating,
  report,
  sharingPdf,
  sources,
}: {
  editable: boolean;
  onOpenCitation(url: string, domain: string): Promise<void>;
  onRegenerate(): void;
  onResearchSettings(): void;
  onSave(content: ReportContent): Promise<void>;
  onSharePdf(): void;
  regenerating: boolean;
  report: ReportRecord;
  sharingPdf: boolean;
  sources: readonly SourceRecord[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gistExpanded, setGistExpanded] = useState(false);
  const [gist, setGist] = useState(report.content.gist);
  const [evidence, setEvidence] = useState(
    report.content.evidence.map((item) => item.text).join("\n"),
  );
  const [risks, setRisks] = useState(report.content.risks.join("\n"));
  const [nextMove, setNextMove] = useState(report.content.nextMove);
  const [verdict, setVerdict] = useState(report.content.verdict ?? "");

  useEffect(() => {
    setEditing(false);
    setError(null);
    setGistExpanded(false);
    setGist(report.content.gist);
    setEvidence(report.content.evidence.map((item) => item.text).join("\n"));
    setRisks(report.content.risks.join("\n"));
    setNextMove(report.content.nextMove);
    setVerdict(report.content.verdict ?? "");
  }, [report]);
  const save = async () => {
    const nextEvidence = evidence
      .split("\n")
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => {
        const previous = report.content.evidence.find(
          (item) => item.text === text,
        );
        return (
          previous ?? {
            id: `manual-evidence-${Date.now()}-${index}`,
            text,
            sourceIds: [],
          }
        );
      });
    const content: ReportContent = {
      gist: gist.trim(),
      evidence: nextEvidence,
      risks: risks
        .split("\n")
        .map((risk) => risk.trim())
        .filter(Boolean),
      nextMove: nextMove.trim(),
      verdict: verdict.trim() || null,
    };
    if (!content.gist || !content.nextMove)
      return setError("The gist and next move cannot be empty.");
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
      setEditing(false);
    } catch {
      setError(
        "This report changed before the edit was saved. Try again from the current report.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.report}>
      <View style={styles.revisionLine}>
        <View>
          <Text style={styles.revision}>Revision {report.revision}</Text>
          <Text style={styles.provenance}>
            {report.phase === "provisional"
              ? "Provisional"
              : editable
                ? "Current report"
                : "Historical report"}
          </Text>
        </View>
        <View style={styles.reportActions}>
          {editable ? (
            <Pressable
              accessibilityLabel={editing ? "Save report edits" : "Edit report"}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => (editing ? void save() : setEditing(true))}
              style={({ pressed }) => [
                styles.reportAction,
                editing && styles.reportActionActive,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : editing ? (
                <Save color={colors.ink} size={18} weight="bold" />
              ) : (
                <Edit color={colors.ink} size={18} weight="bold" />
              )}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Regenerate report"
            accessibilityRole="button"
            disabled={!editable || regenerating}
            onPress={onRegenerate}
            style={({ pressed }) => [
              styles.reportAction,
              (!editable || regenerating) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {regenerating ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Regenerate color={colors.ink} size={18} weight="bold" />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Share report as PDF"
            accessibilityRole="button"
            disabled={sharingPdf}
            onPress={onSharePdf}
            style={({ pressed }) => [
              styles.reportAction,
              sharingPdf && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {sharingPdf ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <FilePdf color={colors.ink} size={18} weight="bold" />
            )}
          </Pressable>
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.editorError}>
          {error}
        </Text>
      ) : null}
      <ReportCard color={colors.primarySoft} label="THE GIST">
        {editing ? (
          <InlineInput
            accessibilityLabel="The gist"
            onChangeText={setGist}
            value={gist}
          />
        ) : (
          <>
            <Text
              numberOfLines={gistExpanded ? undefined : 4}
              style={styles.lead}
            >
              {report.content.gist}
            </Text>
            {report.content.gist.length > 180 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: gistExpanded }}
                onPress={() => setGistExpanded((current) => !current)}
                style={({ pressed }) => [
                  styles.expand,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.expandText}>
                  {gistExpanded ? "Show less" : "Read full gist"}
                </Text>
                {gistExpanded ? (
                  <CaretUp color={colors.ink} size={16} weight="bold" />
                ) : (
                  <CaretDown color={colors.ink} size={16} weight="bold" />
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </ReportCard>
      <ReportCard color={colors.calmSoft} label="EVIDENCE">
        {editing ? (
          <InlineInput
            accessibilityLabel="Evidence, one point per line"
            multiline
            onChangeText={setEvidence}
            value={evidence}
          />
        ) : report.content.evidence.length ? (
          report.content.evidence.map((item) => (
            <Bullet key={item.id} text={item.text} />
          ))
        ) : (
          <View style={styles.researchEmpty}>
            <Text style={styles.muted}>
              No cited research is attached to this revision. Enable research,
              then regenerate the report to search the web.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onResearchSettings}
              style={({ pressed }) => [
                styles.researchButton,
                pressed && styles.pressed,
              ]}
            >
              <MagnifyingGlass color={colors.ink} size={17} weight="bold" />
              <Text style={styles.researchButtonText}>Research settings</Text>
            </Pressable>
          </View>
        )}
        {sources.length ? (
          <View style={styles.sources}>
            <Text style={styles.sourceHeading}>SOURCES</Text>
            {sources.map((source) => (
              <Pressable
                accessibilityRole="link"
                key={source.id}
                onPress={() => void onOpenCitation(source.url, source.domain)}
                style={({ pressed }) => [
                  styles.source,
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.sourceText}>
                  {source.title || source.domain}
                </Text>
                <CaretRight color={colors.inkMuted} size={16} weight="bold" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ReportCard>
      <ReportCard color={colors.happySoft} label="RISK CHECK">
        {editing ? (
          <InlineInput
            accessibilityLabel="Risk check, one point per line"
            multiline
            onChangeText={setRisks}
            value={risks}
          />
        ) : report.content.risks.length ? (
          report.content.risks.map((risk, index) => (
            <Bullet key={`${risk}-${index}`} text={risk} />
          ))
        ) : (
          <Text style={styles.muted}>No risks were added.</Text>
        )}
      </ReportCard>
      <ReportCard color={colors.darkCanvas} dark label="NEXT MOVE">
        {editing ? (
          <InlineInput
            accessibilityLabel="Next move"
            dark
            multiline
            onChangeText={setNextMove}
            value={nextMove}
          />
        ) : (
          <Text style={styles.next}>{report.content.nextMove}</Text>
        )}
      </ReportCard>
      {editing || report.content.verdict ? (
        <ReportCard color={colors.surfaceMuted} label="VERDICT">
          {editing ? (
            <InlineInput
              accessibilityLabel="Verdict, optional"
              multiline
              onChangeText={setVerdict}
              value={verdict}
            />
          ) : (
            <Text style={styles.body}>{report.content.verdict}</Text>
          )}
        </ReportCard>
      ) : null}
    </View>
  );
}
function ReportCard({
  children,
  color,
  dark = false,
  label,
}: {
  children: React.ReactNode;
  color: string;
  dark?: boolean;
  label: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      {children}
    </View>
  );
}
function InlineInput({
  accessibilityLabel,
  dark = false,
  multiline = false,
  onChangeText,
  value,
}: {
  accessibilityLabel: string;
  dark?: boolean;
  multiline?: boolean;
  onChangeText(value: string): void;
  value: string;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      multiline={multiline}
      onChangeText={onChangeText}
      style={[
        styles.inlineInput,
        multiline && styles.inlineInputMultiline,
        dark && styles.inlineInputDark,
      ]}
      textAlignVertical={multiline ? "top" : "center"}
      value={value}
    />
  );
}
function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 26 },
  report: { gap: 12 },
  notice: {
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 18,
  },
  history: { gap: 9, marginBottom: 2 },
  historyTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
  },
  historyOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
  },
  historyButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  historyButtonText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  state: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.primarySoft,
  },
  failed: { backgroundColor: colors.happySoft },
  stateCopy: { minWidth: 0, flex: 1, gap: 4 },
  stateTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 17,
  },
  stateBody: {
    flexShrink: 1,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  retry: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    gap: 7,
    marginTop: 6,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  retryText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  provisional: {
    padding: 15,
    borderRadius: radii.medium,
    backgroundColor: colors.primarySoft,
  },
  outdated: { backgroundColor: colors.happySoft },
  provisionalTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 13,
  },
  provisionalBody: {
    marginTop: 4,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  historicalNotice: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
  },
  revisionLine: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revision: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  provenance: {
    marginTop: 2,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 10,
  },
  reportActions: { flexDirection: "row", gap: 7 },
  reportAction: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 21,
    backgroundColor: colors.canvas,
  },
  reportActionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  card: { gap: 11, padding: 18, borderRadius: radii.large },
  label: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  labelDark: { color: colors.darkMuted },
  lead: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  expand: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingRight: 10,
  },
  expandText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  bulletDot: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: 3,
    backgroundColor: colors.ink,
  },
  body: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  next: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 23,
  },
  muted: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  researchEmpty: { gap: 8 },
  researchButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.56)",
  },
  researchButtonText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  inlineInput: {
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  inlineInputMultiline: { minHeight: 86 },
  inlineInputDark: {
    borderBottomColor: colors.darkLine,
    color: colors.inkInverse,
  },
  editorError: {
    color: colors.danger,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  sources: { gap: 6, marginTop: 4 },
  sourceHeading: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  source: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
    backgroundColor: "rgba(255,255,255,0.56)",
  },
  sourceText: {
    minWidth: 0,
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  locked: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  discuss: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  discussText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 14,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 },
});
