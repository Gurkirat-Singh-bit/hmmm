/**
 * @file RecentIdeasPreview.tsx
 * @description Compact repository-backed recent-ideas preview list for the Home screen.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowClockwiseIcon as ArrowClockwise,
  ArrowUpRightIcon as ArrowUpRight,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { CaptureRecord } from "@/features/domain/contracts";

const cardColors = [
  colors.happySoft,
  colors.calmSoft,
  colors.primarySoft,
] as const;
export function RecentIdeasPreview({
  ideas,
  onDelete,
  onOpen,
  onRetry,
  onSeeAll,
}: {
  ideas: readonly CaptureRecord[];
  onDelete(capture: CaptureRecord): Promise<void>;
  onOpen(id: string): void;
  onRetry(id: string): void;
  onSeeAll(): void;
}) {
  const recentIdeas = ideas.slice(0, 3);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useEffect(() => {
    if (
      deleteArmedId &&
      !ideas.slice(0, 3).some((idea) => idea.id === deleteArmedId)
    )
      setDeleteArmedId(null);
  }, [deleteArmedId, ideas]);
  const remove = async (idea: CaptureRecord) => {
    setDeletingId(idea.id);
    try {
      await onDelete(idea);
      setDeleteArmedId(null);
    } finally {
      setDeletingId(null);
    }
  };
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent ideas</Text>
        <Pressable
          accessibilityLabel="See all ideas"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSeeAll}
          style={({ pressed }) => [
            styles.seeAllButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {recentIdeas.length ? (
          recentIdeas.map((idea, index) => {
            const deleteArmed = deleteArmedId === idea.id;
            const title = ideaTitle(idea);
            const backgroundColor = deleteArmed
              ? colors.dangerSoft
              : cardColors[index % cardColors.length];
            return (
              <Pressable
                accessibilityHint="Hold to reveal delete"
                accessibilityLabel={
                  deleteArmed ? `Cancel deleting ${title}` : `Open ${title}`
                }
                accessibilityRole="button"
                delayLongPress={350}
                key={idea.id}
                onLongPress={() => setDeleteArmedId(idea.id)}
                onPress={() =>
                  deleteArmed ? setDeleteArmedId(null) : onOpen(idea.id)
                }
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor },
                  deleteArmed && styles.deleteArmed,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.copy}>
                  <Text numberOfLines={2} style={styles.idea}>
                    {title}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {deleteArmed
                      ? "Tap the trash button to delete"
                      : captureMeta(idea)}
                  </Text>
                </View>
                {deleteArmed ? (
                  <Pressable
                    accessibilityLabel={`Delete ${title}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: deletingId === idea.id }}
                    disabled={deletingId === idea.id}
                    onPress={(event) => {
                      event.stopPropagation();
                      void remove(idea);
                    }}
                    style={styles.deleteAction}
                  >
                    <Trash color={colors.inkInverse} size={17} weight="bold" />
                  </Pressable>
                ) : idea.status === "failed" ? (
                  <Pressable
                    accessibilityLabel={`Retry ${title}`}
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation();
                      onRetry(idea.id);
                    }}
                    style={styles.action}
                  >
                    <ArrowClockwise
                      color={colors.inkMuted}
                      size={17}
                      weight="bold"
                    />
                  </Pressable>
                ) : (
                  <View style={styles.action}>
                    <ArrowUpRight
                      color={colors.inkMuted}
                      size={17}
                      weight="bold"
                    />
                  </View>
                )}
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.empty}>
            Your saved voice ideas will appear here.
          </Text>
        )}
      </View>
    </View>
  );
}
function ideaTitle(idea: CaptureRecord) {
  return (
    idea.title?.trim() ||
    idea.transcript?.text.trim().slice(0, 70) ||
    "Untitled capture"
  );
}
function captureMeta(idea: CaptureRecord) {
  if (idea.status === "failed" && idea.error?.message)
    return idea.error.message;
  const status = {
    queued: "Saved, processing",
    transcribing: "Transcribing audio",
    naming: "Shaping your idea",
    researching: "Researching",
    ready: "Ready to review",
    failed: "Needs attention",
  }[idea.status];
  const time =
    idea.status === "ready"
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(new Date(idea.createdAt))
      : `updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(idea.updatedAt))}`;
  return `${status} · ${time}`;
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
  },
  seeAllButton: { minHeight: 48, justifyContent: "center" },
  seeAll: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
  },
  list: { gap: 9, marginTop: 12 },
  row: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 13,
    borderRadius: radii.large,
  },
  deleteArmed: { borderWidth: 1, borderColor: colors.danger },
  copy: { minWidth: 0, flex: 1, gap: 4 },
  idea: {
    flexShrink: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  meta: {
    flexShrink: 1,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
  },
  action: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(28,28,28,0.08)",
  },
  empty: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.72 },
  deleteAction: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.danger,
  },
});
