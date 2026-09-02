/**
 * @file OnboardingStepContent.tsx
 * @description Step-specific content and summary presentation for onboarding.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  EndpointField,
  NameField,
  ProviderChoices,
  ResearchTransferChoices,
  SecretField,
} from "@/components/onboarding/OnboardingFields";
import { SearchableModelPicker } from "@/components/onboarding/SearchableModelPicker";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import {
  aiProviders,
  findAiProvider,
  findSpeechProvider,
  speechProviders,
} from "@/features/onboarding/provider-config";
import { useModelCatalog } from "@/features/onboarding/use-model-catalog";
import { useOnboardingFlow } from "@/features/onboarding/use-onboarding-flow";
import { supportsProviderResearch } from "@/features/provider/config";

type Flow = ReturnType<typeof useOnboardingFlow>;

const illustrations = [
  require("@/assets/Onboarding/Onboarding-1.png"),
  require("@/assets/Onboarding/Onboarding-2.png"),
  require("@/assets/Onboarding/Onboarding-3.png"),
] as const;
export function OnboardingStepContent({
  flow,
  compact,
  onNameFocus,
  onNameSubmit,
}: {
  flow: Flow;
  compact: boolean;
  onNameFocus(): void;
  onNameSubmit(): void;
}) {
  const { step } = flow;
  const copy = getStepCopy(step, flow.name);
  const entrance = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reduceMotion.current = enabled;
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion.current) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    Animated.timing(entrance, {
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance, step]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 0],
            }),
          },
        ],
      }}
    >
      <View
        style={[
          styles.illustrationSpace,
          compact && styles.illustrationSpaceCompact,
        ]}
      >
        <Image
          accessibilityLabel={`Onboarding illustration ${step + 1}`}
          resizeMode="contain"
          source={illustrations[step]}
          style={styles.illustration}
        />
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.heading}>
          {copy.heading}
        </Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      {step === 0 ? (
        <NameField
          attempted={flow.attempted}
          onChangeText={flow.setName}
          onFocus={onNameFocus}
          onSubmit={onNameSubmit}
          value={flow.name}
        />
      ) : null}
      {step === 1 ? <SpeechSetup flow={flow} /> : null}
      {step === 2 ? <AiSetup flow={flow} /> : null}
    </Animated.View>
  );
}
function SpeechSetup({ flow }: { flow: Flow }) {
  const provider = findSpeechProvider(flow.speechProvider);
  const catalog = useModelCatalog(
    "speech",
    provider,
    flow.speechKey,
    flow.speechEndpoint,
  );
  return (
    <View style={styles.setup}>
      <View style={styles.setupSection}>
        <ProviderChoices
          options={speechProviders}
          value={flow.speechProvider}
          onChange={(providerId) => {
            flow.setSpeechProvider(providerId);
            flow.setSpeechModel(
              findSpeechProvider(providerId).starterModels[0] ?? "",
            );
            if (providerId !== flow.speechProvider) {
              flow.setSpeechKey("");
              flow.setSpeechEndpoint("");
            }
          }}
        />
      </View>
      <View style={styles.setupSection}>
        {flow.speechProvider === "custom" ? (
          <EndpointField
            attempted={flow.attempted}
            onChangeText={flow.setSpeechEndpoint}
            value={flow.speechEndpoint}
          />
        ) : null}
        <SecretField
          attempted={flow.attempted}
          label="SPEECH API KEY"
          onChangeText={flow.setSpeechKey}
          placeholder="Paste speech API key"
          value={flow.speechKey}
        />
        <SearchableModelPicker
          error={catalog.error}
          label="MODEL"
          loading={catalog.loading}
          onChange={flow.setSpeechModel}
          onRefresh={catalog.canRefresh ? catalog.refresh : undefined}
          options={catalog.models}
          value={flow.speechModel}
        />
      </View>
      <Text style={styles.transferNote}>
        After you finish a recording, its source audio is sent directly to{" "}
        {provider.label} for transcription. Hmmmidea does not relay it through
        its own server.
      </Text>
    </View>
  );
}
function AiSetup({ flow }: { flow: Flow }) {
  const provider = findAiProvider(flow.aiProvider);
  const catalog = useModelCatalog("ai", provider, flow.aiKey, flow.aiEndpoint);
  return (
    <View style={styles.setup}>
      <View style={styles.setupSection}>
        <ProviderChoices
          options={aiProviders}
          value={flow.aiProvider}
          onChange={(providerId) => {
            flow.setAiProvider(providerId);
            flow.setAiModel(findAiProvider(providerId).starterModels[0] ?? "");
            if (providerId !== flow.aiProvider) {
              flow.setAiKey("");
              flow.setAiEndpoint("");
            }
          }}
        />
      </View>
      <View style={styles.setupSection}>
        {flow.aiProvider === "custom" ? (
          <EndpointField
            attempted={flow.attempted}
            onChangeText={flow.setAiEndpoint}
            value={flow.aiEndpoint}
          />
        ) : null}
        <SecretField
          attempted={flow.attempted}
          label="LLM API KEY"
          onChangeText={flow.setAiKey}
          placeholder="Paste LLM API key"
          value={flow.aiKey}
        />
        <SearchableModelPicker
          error={catalog.error}
          label="MODEL"
          loading={catalog.loading}
          onChange={flow.setAiModel}
          onRefresh={catalog.canRefresh ? catalog.refresh : undefined}
          options={catalog.models}
          value={flow.aiModel}
        />
      </View>
      <Text style={styles.transferNote}>
        {provider.label} receives your transcript for reports and chat.
      </Text>
      <ResearchTransferChoices
        attempted={flow.attempted}
        nativeSupported={supportsProviderResearch(
          flow.aiProvider,
          flow.aiModel,
        )}
        onChange={flow.setResearchConsent}
        onSearchKeyChange={flow.setSearchKey}
        onSourceChange={flow.setResearchSource}
        providerLabel={provider.label}
        searchKey={flow.searchKey}
        source={flow.researchSource}
        value={flow.researchConsent}
      />
    </View>
  );
}
function getStepCopy(step: Flow["step"], name: string) {
  return [
    {
      heading: "What should we call you?",
      body: "This name is only used for your greeting.",
    },
    {
      heading: "Turn your voice into words.",
      body: "Choose the speech setup used after an idea is safely recorded.",
    },
    {
      heading: `Shape ideas, ${name.trim() || "your way"}.`,
      body: "Choose an AI model and whether it may search the web.",
    },
  ][step];
}

const styles = StyleSheet.create({
  illustrationSpace: {
    height: 210,
    overflow: "hidden",
    borderRadius: radii.large,
    backgroundColor: colors.canvasSoft,
  },
  illustrationSpaceCompact: { height: 150 },
  illustration: { width: "100%", height: "100%", transform: [{ scale: 1.3 }] },
  copy: { marginTop: 4 },
  heading: {
    maxWidth: 350,
    marginTop: 8,
    color: colors.inkInverse,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 31,
    lineHeight: 36,
  },
  body: {
    maxWidth: 350,
    marginTop: 9,
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },
  setup: { gap: 12, marginTop: 24 },
  setupSection: {
    gap: 14,
    padding: 14,
    borderRadius: radii.large,
    backgroundColor: colors.darkSurface,
  },
  transferNote: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
});
