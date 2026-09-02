/**
 * @file ReportUpdateProposal.tsx
 * @description Explicit confirmation UI for a proposed idea report change.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { ReportUpdateProposal as ReportUpdateProposalModel } from "@/features/domain/contracts";

export type ProposalDecision = "pending" | "applying" | "applied" | "stale";
export function ReportUpdateProposal({
  canApply,
  onApply,
  proposal,
}: {
  canApply: boolean;
  onApply(proposal: ReportUpdateProposalModel): Promise<boolean>;
  proposal: ReportUpdateProposalModel;
}) {
  const [decision, setDecision] = useState<ProposalDecision>("pending");
  useEffect(() => setDecision("pending"), [proposal.id]);
  const apply = async () => {
    if (!canApply || decision !== "pending") return;
    setDecision("applying");
    setDecision((await onApply(proposal)) ? "applied" : "stale");
  };
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>IDEA UPDATE</Text>
      <Text style={styles.title}>Update the saved report?</Text>
      <Text style={styles.proposed}>{proposal.content.nextMove}</Text>
      <Text style={styles.reason}>{proposal.reason}</Text>
      {decision === "pending" ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityHint="Writes this proposed report revision after confirmation"
            accessibilityRole="button"
            disabled={!canApply}
            onPress={() => void apply()}
            style={({ pressed }) => [
              styles.apply,
              !canApply && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.applyText}>Update saved idea</Text>
          </Pressable>
          <View style={styles.keep}>
            <Text style={styles.keepText}>
              {canApply
                ? "Nothing changes until you confirm."
                : "This proposal is based on an older report."}
            </Text>
          </View>
        </View>
      ) : (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.decision,
            decision === "applied" && styles.decisionApplied,
          ]}
        >
          <Text
            style={[
              styles.decisionText,
              decision === "applied" && styles.decisionTextApplied,
            ]}
          >
            {decision === "applying"
              ? "Updating saved idea…"
              : decision === "applied"
                ? "Saved idea updated"
                : "This proposal needs the latest report."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.calmSoft,
  },
  eyebrow: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 3,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
  },
  proposed: {
    marginTop: 10,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  reason: {
    marginTop: 7,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 15 },
  apply: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  applyText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  keep: { flex: 1, justifyContent: "center", paddingHorizontal: 12 },
  keepText: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
  },
  decision: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
  },
  decisionApplied: { borderColor: colors.ink, backgroundColor: colors.ink },
  decisionText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 12,
  },
  decisionTextApplied: { color: colors.inkInverse },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
