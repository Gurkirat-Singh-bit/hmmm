/**
 * @file DiscussionList.tsx
 * @description Discussion summaries and ready-idea entry rows.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowUpRightIcon as ArrowUpRight,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyPanel } from "@/components/EmptyPanel";
import { IdeaVaultRow } from "@/components/vault/IdeaVaultList";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import type {
  CaptureRecord,
  NormalizedError,
} from "@/features/domain/contracts";
import type { DiscussionThreadSummary } from "@/features/discussion/discussion-service";
export function DiscussionList({
  captures,
  deleteArmedId,
  deletingId,
  error,
  loading,
  onDelete,
  onDeleteIntent,
  onOpen,
  onRetry,
  threads,
}: {
  captures: readonly CaptureRecord[];
  deleteArmedId: string | null;
  deletingId: string | null;
  error: NormalizedError | null;
  loading: boolean;
  onDelete(ideaId: string): void;
  onDeleteIntent(ideaId: string | null): void;
  onOpen(ideaId: string): void;
  onRetry(): void;
  threads: readonly DiscussionThreadSummary[];
}) {
  if (loading)
    return (
      <View accessibilityLabel="Loading discussions" style={styles.loading}>
        <View style={styles.skeleton} />
        <View style={styles.skeleton} />
        <View style={styles.skeleton} />
      </View>
    );
  if (error)
    return (
      <View style={styles.recovery}>
        <Text style={styles.recoveryTitle}>Discuss could not load.</Text>
        <Text style={styles.recoveryBody}>
          {error.message || "Your saved conversations remain on this device."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={styles.sections}>
      <View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Continue Discussion
        </Text>
        {threads.length > 0 ? (
          <View style={styles.threadList}>
            {threads.map((thread) => (
              <ThreadRow
                deleteArmed={deleteArmedId === thread.captureId}
                deleting={deletingId === thread.captureId}
                key={thread.captureId}
                onDelete={onDelete}
                onDeleteIntent={onDeleteIntent}
                onOpen={onOpen}
                thread={thread}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyGap}>
            <EmptyPanel
              body="Start with any ready idea below. Its conversation will appear here."
              title="No conversations yet."
            />
          </View>
        )}
      </View>

      <View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Start from an idea
        </Text>
        {captures.length > 0 ? (
          <View style={styles.ideaList}>
            {captures.map((capture) => (
              <IdeaVaultRow
                capture={capture}
                deleteArmed={deleteArmedId === capture.id}
                deleteLabel
                deleting={deletingId === capture.id}
                key={capture.id}
                onDelete={() => onDelete(capture.id)}
                onDeleteIntent={onDeleteIntent}
                onOpen={onOpen}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyGap}>
            <EmptyPanel
              body="Once a capture finishes processing, you can open its report or discuss it here."
              title="No ready ideas yet."
            />
          </View>
        )}
      </View>
    </View>
  );
}
function ThreadRow({
  deleteArmed,
  deleting,
  onDelete,
  onDeleteIntent,
  onOpen,
  thread,
}: {
  deleteArmed: boolean;
  deleting: boolean;
  onDelete(ideaId: string): void;
  onDeleteIntent(ideaId: string | null): void;
  onOpen(ideaId: string): void;
  thread: DiscussionThreadSummary;
}) {
  const time = relativeTime(thread.updatedAt);
  return (
    <Pressable
      accessibilityHint="Hold to reveal delete"
      accessibilityLabel={
        deleteArmed
          ? `Cancel deleting ${thread.title}`
          : `${thread.title}, updated ${time} ago`
      }
      accessibilityRole="button"
      delayLongPress={350}
      onLongPress={() => onDeleteIntent(thread.captureId)}
      onPress={() =>
        deleteArmed ? onDeleteIntent(null) : onOpen(thread.captureId)
      }
      style={({ pressed }) => [
        styles.threadRow,
        deleteArmed && styles.threadRowDelete,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.copy}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {thread.title}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text numberOfLines={1} style={styles.preview}>
          {thread.preview}
        </Text>
      </View>
      {deleteArmed ? (
        <Pressable
          accessibilityLabel={`Delete ${thread.title}`}
          accessibilityRole="button"
          disabled={deleting}
          onPress={(event) => {
            event.stopPropagation();
            onDelete(thread.captureId);
          }}
          style={styles.deleteAction}
        >
          <Trash color={colors.inkInverse} size={17} weight="bold" />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      ) : (
        <View style={styles.open}>
          <ArrowUpRight color={colors.inkMuted} size={17} weight="bold" />
        </View>
      )}
    </Pressable>
  );
}
function relativeTime(timestamp: string) {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Saved";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  sections: { gap: 30 },
  sectionTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 21,
    letterSpacing: -0.35,
  },
  threadList: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  threadRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  threadRowDelete: {
    paddingHorizontal: 12,
    borderBottomColor: colors.danger,
    borderRadius: radii.medium,
    backgroundColor: colors.dangerSoft,
  },
  copy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 19,
  },
  time: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 10,
  },
  preview: {
    marginTop: 3,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  open: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    borderRadius: 19,
    backgroundColor: "rgba(28,28,28,0.08)",
  },
  deleteAction: {
    minWidth: 92,
    height: 48,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginLeft: 10,
    paddingHorizontal: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.danger,
  },
  deleteText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  ideaList: { gap: 8, marginTop: 12 },
  emptyGap: { marginTop: 14 },
  loading: { gap: 10 },
  skeleton: {
    height: 84,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  recovery: {
    alignItems: "center",
    padding: 24,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  recoveryTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
  },
  recoveryBody: {
    marginTop: 6,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retry: {
    minHeight: 48,
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  retryText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 13,
  },
  pressed: { opacity: 0.7 },
});
