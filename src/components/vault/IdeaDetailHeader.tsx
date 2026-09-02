/**
 * @file IdeaDetailHeader.tsx
 * @description Idea-detail heading with navigation, status, and primary actions.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowLeftIcon as ArrowLeft,
  CheckIcon as Check,
  PencilSimpleIcon as Pencil,
  ShareNetworkIcon as Share,
  StarIcon as Star,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CAPTURE_TITLE_MAX_CHARACTERS,
  type CaptureRecord,
} from "@/features/domain/contracts";
import { colors, onboardingFonts } from "@/constants/theme";
export function IdeaDetailHeader({
  capture,
  onDelete,
  onRename,
  onShare,
  onToggleStar,
}: {
  capture: CaptureRecord;
  onDelete(): void;
  onRename(title: string): Promise<void>;
  onShare(): void;
  onToggleStar(): void;
}) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(
    capture.title?.trim() || "Untitled idea",
  );
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  useEffect(() => {
    if (!editingTitle) setTitleDraft(capture.title?.trim() || "Untitled idea");
  }, [capture.title, editingTitle]);
  const status = statusText(capture.status);
  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!title) return setTitleError("The title cannot be empty.");
    setSavingTitle(true);
    setTitleError(null);
    try {
      await onRename(title);
      setEditingTitle(false);
    } catch {
      setTitleError(
        "The title could not be saved. Refresh this idea and try again.",
      );
    } finally {
      setSavingTitle(false);
    }
  };
  return (
    <View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Back to Vault"
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/vault")
          }
          style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.ink} size={21} weight="bold" />
        </Pressable>
        <View style={styles.trailing}>
          <Pressable
            accessibilityLabel={capture.starred ? "Remove star" : "Star idea"}
            accessibilityRole="button"
            onPress={onToggleStar}
            style={({ pressed }) => [
              styles.circle,
              capture.starred && styles.starred,
              pressed && styles.pressed,
            ]}
          >
            <Star
              color={colors.ink}
              size={19}
              weight={capture.starred ? "fill" : "regular"}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={editingTitle ? "Save idea name" : "Rename idea"}
            accessibilityRole="button"
            disabled={savingTitle}
            onPress={() =>
              editingTitle ? void saveTitle() : setEditingTitle(true)
            }
            style={({ pressed }) => [
              styles.circle,
              pressed && styles.pressed,
              savingTitle && styles.disabled,
            ]}
          >
            {savingTitle ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : editingTitle ? (
              <Check color={colors.ink} size={19} weight="bold" />
            ) : (
              <Pencil color={colors.ink} size={19} weight="bold" />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Delete idea"
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [
              styles.circle,
              styles.deleteCircle,
              pressed && styles.pressed,
            ]}
          >
            <Trash color={colors.danger} size={19} weight="bold" />
          </Pressable>
          <Pressable
            accessibilityLabel="Share idea as text"
            accessibilityRole="button"
            onPress={onShare}
            style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          >
            <Share color={colors.ink} size={19} weight="bold" />
          </Pressable>
        </View>
      </View>
      <Text style={styles.kicker}>IDEA REPORT</Text>
      {editingTitle ? (
        <TextInput
          accessibilityLabel="Idea title"
          autoFocus
          maxLength={CAPTURE_TITLE_MAX_CHARACTERS}
          onChangeText={setTitleDraft}
          onSubmitEditing={() => void saveTitle()}
          returnKeyType="done"
          selectTextOnFocus
          style={[styles.title, styles.titleInput]}
          value={titleDraft}
        />
      ) : (
        <Text accessibilityRole="header" style={styles.title}>
          {capture.title?.trim() || "Untitled idea"}
        </Text>
      )}
      <Text accessibilityLiveRegion="polite" style={styles.meta}>
        {status}
        {capture.status === "ready"
          ? ""
          : ` · updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(capture.updatedAt))}`}{" "}
        · Saved locally
      </Text>
      {titleError ? (
        <Text accessibilityLiveRegion="polite" style={styles.renameError}>
          {titleError}
        </Text>
      ) : null}
    </View>
  );
}
function statusText(status: CaptureRecord["status"]) {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Needs attention";
  if (status === "researching") return "Researching";
  if (status === "naming") return "Structuring";
  if (status === "transcribing") return "Transcribing";
  return "Queued";
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trailing: { flexDirection: "row", gap: 8 },
  circle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.canvas,
  },
  starred: { borderColor: colors.happy, backgroundColor: colors.happySoft },
  deleteCircle: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  kicker: {
    marginTop: 25,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.15,
  },
  title: {
    maxWidth: 350,
    marginTop: 7,
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.7,
  },
  titleInput: {
    width: "100%",
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  meta: {
    marginTop: 8,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
  },
  renameError: {
    color: colors.danger,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.4 },
});
