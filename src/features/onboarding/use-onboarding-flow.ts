/**
 * @file use-onboarding-flow.ts
 * @description React state, validation, provider checks, and secure completion for Android onboarding.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import type {
  ResearchConsent,
  ResearchSource,
} from "@/features/domain/contracts";
import { normalizeError } from "@/features/domain/errors";
import {
  defaultAiModel,
  defaultAiProvider,
  defaultSpeechModel,
  defaultSpeechProvider,
  findAiProvider,
  findSpeechProvider,
  type AiProvider,
  type SpeechProvider,
} from "@/features/onboarding/provider-config";
import { readProfile, saveProfile } from "@/features/onboarding/storage";
import { probeSelectedProviders } from "@/features/provider/probes";
import {
  RESEARCH_SOURCES,
  supportsProviderResearch,
} from "@/features/provider/config";
import { serpApiSearchProvider } from "@/features/provider/search/serpapi";
import { refreshAppRuntime } from "@/features/runtime/app-runtime";

export const onboardingStepCount = 5;
export type OnboardingStep = 0 | 1 | 2 | 3 | 4;
export type OnboardingNotice = { title: string; body: string } | null;
type ResearchDecision =
  Exclude<ResearchConsent["status"], "unknown"> | "unknown";
export function useOnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(0);
  const [name, setName] = useState("");
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>(
    defaultSpeechProvider,
  );
  const [speechModel, setSpeechModel] = useState<string>(defaultSpeechModel);
  const [speechKey, setSpeechKey] = useState("");
  const [speechEndpoint, setSpeechEndpoint] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>(defaultAiProvider);
  const [aiModel, setAiModel] = useState<string>(defaultAiModel);
  const [aiKey, setAiKey] = useState("");
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [researchConsent, setResearchConsent] =
    useState<ResearchDecision>("unknown");
  const [researchSource, setResearchSource] = useState<ResearchSource>(
    RESEARCH_SOURCES.aiNative,
  );
  const [searchKey, setSearchKey] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<OnboardingNotice>(null);

  useEffect(() => {
    void readProfile()
      .then((profile) => {
        if (!profile) return;
        setName(profile.name);
        const savedSpeechProvider = findSpeechProvider(
          profile.speechProvider as SpeechProvider,
        ).id;
        const savedAiProvider = findAiProvider(
          profile.aiProvider as AiProvider,
        ).id;
        setSpeechProvider(savedSpeechProvider);
        setSpeechModel(
          profile.speechModel ||
            findSpeechProvider(savedSpeechProvider).starterModels[0] ||
            "",
        );
        setSpeechKey(profile.speechKey);
        setSpeechEndpoint(profile.speechEndpoint);
        setAiProvider(savedAiProvider);
        setAiModel(
          profile.aiModel ||
            findAiProvider(savedAiProvider).starterModels[0] ||
            "",
        );
        setAiKey(profile.aiKey);
        setAiEndpoint(profile.aiEndpoint);
        setResearchSource(profile.researchSource ?? RESEARCH_SOURCES.aiNative);
        setResearchConsent(profile.researchConsent ?? "unknown");
        setSearchKey(profile.searchKey ?? "");
      })
      .catch(() =>
        setNotice({
          title: "Couldn\u2019t load setup",
          body: "Check device storage, then try again.",
        }),
      );
  }, []);

  const stepComplete =
    step === 0
      ? Boolean(name.trim())
      : step === 1
        ? Boolean(
            speechKey.trim() &&
            speechModel.trim() &&
            (speechProvider !== "custom" || speechEndpoint.trim()),
          )
        : step === 2
          ? Boolean(
              aiKey.trim() &&
              aiModel.trim() &&
              (aiProvider !== "custom" || aiEndpoint.trim()),
            )
          : step === 3
            ? Boolean(
                researchConsent !== "unknown" &&
                (researchConsent === "denied" ||
                  (researchSource.kind === "external"
                    ? searchKey.trim()
                    : supportsProviderResearch(aiProvider, aiModel))),
              )
            : true;
  const moveTo = (nextStep: OnboardingStep) => {
    setAttempted(false);
    setStep(nextStep);
  };
  const next = () => {
    if (!stepComplete) {
      setAttempted(true);
      return false;
    }
    moveTo(Math.min(step + 1, onboardingStepCount - 1) as OnboardingStep);
    return true;
  };
  const previous = () => moveTo(Math.max(0, step - 1) as OnboardingStep);
  const finish = async () => {
    if (!stepComplete) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setNotice(null);
    const speech = {
      providerId: speechProvider,
      model: speechModel.trim(),
      endpoint: speechEndpoint.trim() || null,
    };
    const ai = {
      providerId: aiProvider,
      model: aiModel.trim(),
      endpoint: aiEndpoint.trim() || null,
    };
    try {
      await Promise.all([
        probeSelectedProviders({
          speech: { selection: speech, apiKey: speechKey.trim() },
          ai: { selection: ai, apiKey: aiKey.trim() },
        }),
        researchConsent === "granted" && researchSource.kind === "external"
          ? serpApiSearchProvider.probe({ apiKey: searchKey.trim() })
          : Promise.resolve(),
      ]);
      await saveProfile(
        {
          name,
          speechProvider,
          speechModel,
          speechKey,
          speechEndpoint,
          aiProvider,
          aiModel,
          aiKey,
          aiEndpoint,
          researchSource,
          searchKey:
            researchConsent === "granted" && researchSource.kind === "external"
              ? searchKey
              : "",
        },
        {
          onboardingComplete: true,
          researchEnabled: researchConsent === "granted",
          researchConsent: researchConsent as Exclude<
            ResearchConsent["status"],
            "unknown"
          >,
        },
      );
      await refreshAppRuntime();
      router.replace("/");
    } catch (error) {
      const detail = normalizeError(error, "provider-configuration");
      const provider =
        detail.providerId === speechProvider
          ? findSpeechProvider(speechProvider).label
          : detail.providerId === aiProvider
            ? findAiProvider(aiProvider).label
            : detail.providerId === "serpapi"
              ? "SerpApi"
              : "Provider";
      setNotice({ title: `${provider} check failed`, body: detail.message });
    } finally {
      setSaving(false);
    }
  };

  return {
    step,
    name,
    setName,
    speechProvider,
    setSpeechProvider,
    speechModel,
    setSpeechModel,
    speechKey,
    setSpeechKey,
    speechEndpoint,
    setSpeechEndpoint,
    aiProvider,
    setAiProvider,
    aiModel,
    setAiModel,
    aiKey,
    setAiKey,
    aiEndpoint,
    setAiEndpoint,
    researchConsent,
    setResearchConsent,
    researchSource,
    setResearchSource,
    searchKey,
    setSearchKey,
    attempted,
    saving,
    notice,
    setNotice,
    stepComplete,
    next,
    previous,
    finish,
  };
}
