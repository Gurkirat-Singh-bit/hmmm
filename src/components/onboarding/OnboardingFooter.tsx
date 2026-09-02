/**
 * @file OnboardingFooter.tsx
 * @description Navigation footer for moving through the onboarding flow.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
} from "phosphor-react-native";

import { colors, onboardingFonts, radii, spacing } from "@/constants/theme";
import {
  onboardingStepCount,
  OnboardingStep,
} from "@/features/onboarding/use-onboarding-flow";
export function OnboardingFooter({
  step,
  complete,
  saving,
  onBack,
  onContinue,
}: {
  step: OnboardingStep;
  complete: boolean;
  saving: boolean;
  onBack(): void;
  onContinue(): void;
}) {
  const finalStep = step === onboardingStepCount - 1;
  return (
    <View style={styles.footer}>
      {step > 0 ? (
        <Pressable
          accessibilityLabel="Previous step"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={onBack}
          style={({ pressed }) => [
            styles.back,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <ArrowLeft color={colors.inkInverse} size={20} weight="bold" />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityHint={
          complete
            ? "Continues setup."
            : "Completes the required information for this step."
        }
        accessibilityLabel={
          saving
            ? "Saving setup"
            : finalStep
              ? "Verify providers and start capturing"
              : "Continue setup"
        }
        accessibilityRole="button"
        accessibilityState={{ busy: saving, disabled: saving }}
        disabled={saving}
        onPress={onContinue}
        style={({ pressed }) => [
          styles.next,
          pressed && styles.pressed,
          saving && styles.disabled,
        ]}
      >
        <View style={styles.copy}>
          <Text style={styles.label}>
            {saving
              ? "Verifying providers"
              : finalStep
                ? "Start capturing"
                : "Continue"}
          </Text>
          <Text numberOfLines={1} style={styles.hint}>
            {saving
              ? "Checking configured connections"
              : complete
                ? finalStep
                  ? "Consent and setup are ready"
                  : "Go to the next step"
                : "Complete this step first"}
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator color={colors.ink} size="small" />
        ) : finalStep ? (
          <Check color={colors.ink} size={20} weight="bold" />
        ) : (
          <ArrowRight color={colors.ink} size={20} weight="bold" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.page,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.darkLine,
    backgroundColor: colors.darkCanvas,
  },
  back: {
    width: 56,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.darkSurface,
  },
  next: {
    minHeight: 60,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 19,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
  },
  copy: { flex: 1, gap: 2 },
  label: {
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 16,
  },
  hint: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 10,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
