/**
 * @file IdeaVaultList.tsx
 * @description Rounded Vault collection panel and idea rows.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowUpRightIcon as ArrowUpRight,
  StarIcon as Star,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { CaptureRecord } from "@/features/domain/contracts";

const accents = [
  colors.primarySoft,
  colors.calmSoft,
  colors.happySoft,
] as const;
const strongAccents = [colors.primary, colors.calm, colors.happy] as const;
export function IdeaVaultList({
  captures,
  deleteArmedId,
  deletingId,
  onDelete,
  onDeleteIntent,
  onOpen,
  onToggleStar,
}: {
  captures: readonly CaptureRecord[];
  deleteArmedId: string | null;
  deletingId: string | null;
  onDelete(capture: CaptureRecord): void;
  onDeleteIntent(id: string | null): void;
  onOpen(id: string): void;
  onToggleStar(capture: CaptureRecord): void;
}) {
  return (
    <View style={styles.list}>
      {captures.map((capture) => (
        <IdeaVaultRow
          capture={capture}
          deleteArmed={deleteArmedId === capture.id}
          deleting={deletingId === capture.id}
          key={capture.id}
          onDelete={onDelete}
          onDeleteIntent={onDeleteIntent}
          onOpen={onOpen}
          onToggleStar={onToggleStar}
        />
      ))}
      {captures.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No ideas found.</Text>
          <Text style={styles.emptyBody}>Try another search or filter.</Text>
        </View>
      ) : null}
    </View>
  );
}
export function IdeaVaultRow({
  capture,
  deleteLabel = false,
  deleteArmed = false,
  deleting = false,
  onDelete,
  onDeleteIntent,
  onOpen,
  onToggleStar,
}: {
  capture: CaptureRecord;
  deleteLabel?: boolean;
  deleteArmed?: boolean;
  deleting?: boolean;
  onDelete?(capture: CaptureRecord): void;
  onDeleteIntent?(id: string | null): void;
  onOpen(id: string): void;
  onToggleStar?(capture: CaptureRecord): void;
}) {
  const accent = accentIndex(capture);
  const title = capture.title?.trim() || "Untitled idea";
  return (
    <Pressable
      accessibilityHint="Hold to reveal delete"
      accessibilityLabel={
        deleteArmed ? `Cancel deleting ${title}` : `Open ${title}`
      }
      accessibilityRole="button"
      delayLongPress={350}
      onLongPress={
        onDeleteIntent ? () => onDeleteIntent(capture.id) : undefined
      }
      onPress={() =>
        deleteArmed ? onDeleteIntent?.(null) : onOpen(capture.id)
      }
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: deleteArmed ? colors.dangerSoft : accents[accent] },
        deleteArmed && styles.deleteArmed,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <Text style={styles.meta}>
          {deleteArmed ? "Tap trash to delete" : statusLabel(capture)}
        </Text>
      </View>
      {deleteArmed ? (
        <Pressable
          accessibilityLabel={`Delete ${title}`}
          accessibilityRole="button"
          disabled={deleting}
          onPress={(event) => {
            event.stopPropagation();
            onDelete?.(capture);
          }}
          style={[
            styles.deleteAction,
            deleteLabel && styles.deleteActionLabeled,
          ]}
        >
          <Trash color={colors.inkInverse} size={17} weight="bold" />
          {deleteLabel ? <Text style={styles.deleteText}>Delete</Text> : null}
        </Pressable>
      ) : (
        <>
          {onToggleStar ? (
            <Pressable
              accessibilityLabel={
                capture.starred ? `Unstar ${title}` : `Star ${title}`
              }
              accessibilityRole="button"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onToggleStar(capture);
              }}
              style={[
                styles.starButton,
                capture.starred && { backgroundColor: strongAccents[accent] },
              ]}
            >
              <Star
                color={colors.ink}
                size={17}
                weight={capture.starred ? "fill" : "regular"}
              />
            </Pressable>
          ) : null}
          <View style={styles.open}>
            <ArrowUpRight color={colors.inkMuted} size={17} weight="bold" />
          </View>
        </>
      )}
    </Pressable>
  );
}
function accentIndex(capture: CaptureRecord): 0 | 1 | 2 {
  if (capture.status !== "ready") return capture.status === "failed" ? 2 : 0;
  let hash = 0;
  for (const character of capture.id)
    hash = (hash + character.charCodeAt(0)) % accents.length;
  return hash as 0 | 1 | 2;
}
function statusLabel(capture: CaptureRecord) {
  if (capture.status === "ready") return "Ready";
  if (capture.status === "failed") return "Needs attention";
  const status =
    capture.status === "transcribing"
      ? "Transcribing audio"
      : capture.status === "researching"
        ? "Researching"
        : capture.status === "naming"
          ? "Structuring report"
          : "Queued";
  const updated = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(capture.updatedAt));
  return `${status} · updated ${updated}`;
}

const styles = StyleSheet.create({
  list: { gap: 9, marginTop: 20 },
  row: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radii.large,
  },
  deleteArmed: { borderColor: colors.danger },
  copy: { minWidth: 0, flex: 1, gap: 5 },
  title: {
    maxWidth: 245,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  starButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.52)",
  },
  meta: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  open: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(28,28,28,0.08)",
  },
  deleteAction: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.danger,
  },
  deleteActionLabeled: {
    width: "auto",
    minWidth: 92,
    height: 48,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: radii.medium,
  },
  deleteText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  pressed: { opacity: 0.7 },
  empty: { alignItems: "center", paddingVertical: 34 },
  emptyTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
  },
  emptyBody: {
    marginTop: 4,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 11,
  },
});
