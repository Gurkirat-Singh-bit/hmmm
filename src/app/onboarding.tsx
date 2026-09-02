/**
 * @file onboarding.tsx
 * @description Onboarding route for profile and provider configuration.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRef } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { OnboardingNotice } from "@/components/onboarding/OnboardingNotice";
import { OnboardingStepContent } from "@/components/onboarding/OnboardingStepContent";
import { colors, onboardingFonts, radii, spacing } from "@/constants/theme";
import {
  onboardingStepCount,
  useOnboardingFlow,
} from "@/features/onboarding/use-onboarding-flow";
export default function OnboardingScreen() {
  const flow = useOnboardingFlow();
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const moveForward = () => {
    if (flow.next()) {
      scrollRef.current?.scrollTo({ animated: true, y: 0 });
    } else {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };
  const moveBack = () => {
    flow.previous();
    scrollRef.current?.scrollTo({ animated: true, y: 0 });
  };
  const finishSetup = () => {
    if (!flow.stepComplete) {
      void flow.finish();
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
      return;
    }
    void flow.finish();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior="height" style={styles.keyboard}>
        <View style={styles.topBar}>
          <Text style={styles.stepCount}>
            {flow.step + 1} OF {onboardingStepCount}
          </Text>
          <View
            accessibilityLabel={`Onboarding step ${flow.step + 1} of ${onboardingStepCount}`}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 1,
              max: onboardingStepCount,
              now: flow.step + 1,
            }}
            style={styles.progressTrack}
          >
            <View
              style={[
                styles.progress,
                { width: `${((flow.step + 1) / onboardingStepCount) * 100}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
        >
          <OnboardingStepContent
            compact={height < 740}
            flow={flow}
            onNameFocus={() =>
              setTimeout(
                () => scrollRef.current?.scrollToEnd({ animated: true }),
                180,
              )
            }
            onNameSubmit={moveForward}
          />
        </ScrollView>

        <OnboardingFooter
          complete={flow.stepComplete}
          onBack={moveBack}
          onContinue={
            flow.step === onboardingStepCount - 1 ? finishSetup : moveForward
          }
          saving={flow.saving}
          step={flow.step}
        />
      </KeyboardAvoidingView>
      <OnboardingNotice
        notice={flow.notice}
        onClose={() => flow.setNotice(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.darkCanvas },
  keyboard: { flex: 1 },
  topBar: {
    zIndex: 1,
    gap: 8,
    paddingHorizontal: spacing.page,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.darkCanvas,
  },
  stepCount: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: "right",
  },
  progressTrack: {
    height: 3,
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.darkLine,
  },
  progress: {
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  scroller: { flex: 1, overflow: "hidden", backgroundColor: colors.darkCanvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 13,
    paddingBottom: 48,
  },
});
