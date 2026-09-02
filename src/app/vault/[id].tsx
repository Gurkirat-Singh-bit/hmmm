/**
 * @file [id].tsx
 * @description Dynamic Vault route that renders a saved idea and its report revisions.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { IdeaDetailHeader } from "@/components/vault/IdeaDetailHeader";
import { IdeaDetailState } from "@/components/vault/IdeaDetailState";
import { IdeaReportSections } from "@/components/vault/IdeaReportSections";
import { IdeaSourceAudio } from "@/components/vault/IdeaSourceAudio";
import { RegenerationControl } from "@/components/vault/RegenerationControl";
import { colors, onboardingFonts, spacing } from "@/constants/theme";
import type { ReportField } from "@/features/domain/contracts";
import { normalizeError } from "@/features/domain/errors";
import { shareIdeaPdfExport } from "@/features/export/export-service";
import { useIdeaDetail } from "@/features/vault/use-idea-detail";
import { useIdeaPlayback } from "@/features/vault/use-idea-playback";
import {
  deleteCaptures,
  openCitation,
  regenerateReport,
  renameCapture,
  saveManualReport,
  setCaptureStarred,
  shareCaptures,
} from "@/features/vault/vault-service";
export default function IdeaDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const detail = useIdeaDetail(id, selectedRevision);
  const playback = useIdeaPlayback(detail.data?.capture.audio ?? null);
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (detail.loading)
    return (
      <IdeaDetailState kind="loading" onBack={() => router.replace("/vault")} />
    );
  if (detail.error)
    return (
      <IdeaDetailState
        kind="error"
        onBack={() => router.replace("/vault")}
        onRetry={detail.refresh}
      />
    );
  if (!detail.data || !id)
    return (
      <IdeaDetailState kind="missing" onBack={() => router.replace("/vault")} />
    );
  const { capture, jobs, report, revisions, sources } = detail.data;
  const activeReport =
    capture.activeReportRevision === null
      ? null
      : (revisions.find(
          (revision) => revision.revision === capture.activeReportRevision,
        ) ?? null);
  const regenerate = async (
    expectedActiveRevision: number | null,
    explicitlyReplacedUserFields: readonly ReportField[],
  ) => {
    setRegenerating(true);
    setNotice(null);
    try {
      await regenerateReport(
        capture,
        expectedActiveRevision,
        explicitlyReplacedUserFields,
      );
      setSelectedRevision(null);
      setRegenerationOpen(false);
      setNotice(
        explicitlyReplacedUserFields.length
          ? "A new report revision is queued. Selected edits will be replaced; the rest stay protected."
          : "A new report revision is queued. Your edits will remain protected.",
      );
      detail.refresh();
    } catch (error) {
      const normalized = normalizeError(error, "report-generation");
      setNotice(
        normalized.code === "conflict"
          ? "The report changed before regeneration was queued. Refresh this idea, review the current revision, and try again."
          : normalized.message,
      );
    } finally {
      setRegenerating(false);
    }
  };
  const openRegeneration = () => {
    setNotice(null);
    setRegenerationOpen(true);
  };
  const toggleStar = async () => {
    try {
      await setCaptureStarred(capture, !capture.starred);
      detail.refresh();
    } catch {
      setNotice("Could not update the star.");
    }
  };
  const share = async () => {
    try {
      await shareCaptures([capture.id]);
    } catch {
      setNotice("Could not open sharing for this idea.");
    }
  };
  const sharePdf = async () => {
    if (!report) {
      setNotice("PDF sharing is available once this idea has a report.");
      return;
    }
    setSharingPdf(true);
    setNotice(null);
    try {
      await shareIdeaPdfExport(capture, report, sources);
      setNotice("The PDF share sheet is open.");
    } catch (error) {
      setNotice(
        `PDF export failed: ${normalizeError(error, "export").message}`,
      );
    } finally {
      setSharingPdf(false);
    }
  };
  const rename = async (title: string) => {
    setNotice(null);
    await renameCapture(capture, title);
    detail.refresh();
  };
  const remove = () => {
    Alert.alert(
      "Delete this idea?",
      "Its report, discussion, transcript, and saved source audio will be removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void deleteCaptures([capture])
              .then(() => router.replace("/vault"))
              .catch((error) =>
                setNotice(
                  `Delete failed: ${normalizeError(error, "database").message}`,
                ),
              ),
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 42 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <IdeaDetailHeader
          capture={capture}
          onDelete={remove}
          onRename={rename}
          onShare={() => void share()}
          onToggleStar={() => void toggleStar()}
        />
        <RegenerationControl
          expectedActiveRevision={capture.activeReportRevision}
          onCancel={() => setRegenerationOpen(false)}
          onConfirm={regenerate}
          open={regenerationOpen}
          regenerating={regenerating}
          report={activeReport}
        />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <IdeaSourceAudio
          audio={capture.audio}
          error={playback.error}
          onStop={() => void playback.stop()}
          onToggle={() => void playback.toggle()}
          playbackState={playback.state}
          positionMs={playback.positionMs}
          durationMs={playback.durationMs}
          transcript={capture.transcript?.text ?? null}
        />
        <IdeaReportSections
          capture={capture}
          jobs={jobs}
          onDiscuss={() =>
            router.push({
              pathname: "/discuss/[ideaId]",
              params: { ideaId: capture.id },
            })
          }
          onOpenCitation={openCitation}
          onRegenerate={openRegeneration}
          onResearchSettings={() => router.push("/settings/research")}
          onSaveManual={async (content) => {
            if (!report) return;
            await saveManualReport(capture.id, report, content, sources);
            setSelectedRevision(null);
            detail.refresh();
          }}
          onSelectRevision={setSelectedRevision}
          onSharePdf={() => void sharePdf()}
          regenerating={regenerating}
          report={report}
          revisions={revisions}
          sharingPdf={sharingPdf}
          sources={sources}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 14,
    paddingBottom: 42,
  },
  notice: {
    marginTop: 14,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 18,
  },
});
