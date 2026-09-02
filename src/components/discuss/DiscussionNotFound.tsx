/**
 * @file DiscussionNotFound.tsx
 * @description Missing-idea state for discussion routes whose capture no longer exists.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowLeftIcon as ArrowLeft,
  WarningCircleIcon as Warning,
} from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, onboardingFonts, radii, spacing } from "@/constants/theme";
export function DiscussionNotFound({
  kind = "missing",
  onBack,
  onRetry,
  onVault,
}: {
  kind?: "error" | "loading" | "missing";
  onBack(): void;
  onRetry?(): void;
  onVault(): void;
}) {
  if (kind === "loading")
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View accessibilityLabel="Loading discussion" style={styles.loading}>
          <View style={styles.loadingCircle} />
          <View style={styles.loadingTitle} />
          <View style={styles.loadingCard} />
          <View style={styles.loadingCard} />
        </View>
      </SafeAreaView>
    );
  const error = kind === "error";
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <Pressable
        accessibilityLabel="Back to Discuss"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
      >
        <ArrowLeft color={colors.ink} size={21} weight="bold" />
      </Pressable>
      <View style={styles.copy}>
        <View style={styles.icon}>
          {error ? (
            <Warning color={colors.ink} size={27} weight="bold" />
          ) : (
            <ArrowLeft color={colors.ink} size={27} weight="bold" />
          )}
        </View>
        <Text style={styles.eyebrow}>
          {error ? "DISCUSSION UNAVAILABLE" : "CONVERSATION NOT FOUND"}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {error
            ? "This conversation could not load."
            : "This idea is no longer here."}
        </Text>
        <Text style={styles.body}>
          {error
            ? "Your local messages are still safe. Try again, or return to Discuss."
            : "It may have been removed, or the link may be incomplete. Choose another idea from Discuss or return to the Vault."}
        </Text>
        <View style={styles.actions}>
          {error && onRetry ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>Back to Discuss</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onVault}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>Open Vault</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 10,
    backgroundColor: colors.canvas,
  },
  circle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
  },
  loading: { flex: 1, gap: 16, paddingTop: 18 },
  loadingCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
  },
  loadingTitle: {
    width: "70%",
    height: 48,
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceMuted,
  },
  loadingCard: {
    height: 112,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  copy: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 70,
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  eyebrow: {
    marginTop: 18,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  title: {
    maxWidth: 320,
    marginTop: 8,
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 29,
    lineHeight: 34,
    textAlign: "center",
  },
  body: {
    maxWidth: 330,
    marginTop: 10,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 9,
    marginTop: 24,
  },
  primary: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  primaryText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  secondary: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
  },
  secondaryText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  pressed: { opacity: 0.7 },
});
