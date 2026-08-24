/**
 * @file use-onboarding-flow.ts
 * @description State, validation, navigation, and persistence for onboarding.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  AiProvider,
  defaultAiProvider,
  defaultAiModel,
  defaultSpeechModel,
  defaultSpeechProvider,
  findAiProvider,
  findSpeechProvider,
  SpeechProvider,
} from '@/features/onboarding/provider-config';
import { readProfile, saveProfile } from '@/features/onboarding/storage';

export const onboardingStepCount = 4;
export type OnboardingStep = 0 | 1 | 2 | 3;
export type OnboardingNotice = { title: string; body: string } | null;

export function useOnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(0);
  const [name, setName] = useState('');
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>(defaultSpeechProvider);
  const [speechModel, setSpeechModel] = useState<string>(defaultSpeechModel);
  const [speechKey, setSpeechKey] = useState('');
  const [speechEndpoint, setSpeechEndpoint] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>(defaultAiProvider);
  const [aiModel, setAiModel] = useState<string>(defaultAiModel);
  const [aiKey, setAiKey] = useState('');
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<OnboardingNotice>(null);

  useEffect(() => {
    void readProfile().then((profile) => {
      if (!profile) return;
      setName(profile.name);
      const savedSpeechProvider = findSpeechProvider(profile.speechProvider as SpeechProvider).id;
      const savedAiProvider = findAiProvider(profile.aiProvider as AiProvider).id;
      setSpeechProvider(savedSpeechProvider);
      setSpeechModel(profile.speechModel || findSpeechProvider(savedSpeechProvider).starterModels[0] || '');
      setSpeechKey(profile.speechKey);
      setSpeechEndpoint(profile.speechEndpoint);
      setAiProvider(savedAiProvider);
      setAiModel(profile.aiModel || findAiProvider(savedAiProvider).starterModels[0] || '');
      setAiKey(profile.aiKey);
      setAiEndpoint(profile.aiEndpoint);
    });
  }, []);

  const stepComplete =
    step === 0 ? Boolean(name.trim()) :
    step === 1 ? Boolean(speechKey.trim() && speechModel.trim() && (speechProvider !== 'custom' || speechEndpoint.trim())) :
    step === 2 ? Boolean(aiKey.trim() && aiModel.trim() && (aiProvider !== 'custom' || aiEndpoint.trim())) : true;

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

  const previous = () => moveTo((step - 1) as OnboardingStep);

  const finish = async () => {
    setSaving(true);
    try {
      await saveProfile({
        name: name.trim(), speechProvider, speechModel, speechKey: speechKey.trim(), speechEndpoint: speechEndpoint.trim(),
        aiProvider, aiModel, aiKey: aiKey.trim(), aiEndpoint: aiEndpoint.trim(),
      });
      router.replace('/');
    } catch {
      setNotice({ title: 'Couldn’t save securely', body: 'Nothing was lost. Check your device storage and try again.' });
      setSaving(false);
    }
  };

  return {
    step, name, setName, speechProvider, setSpeechProvider, speechModel, setSpeechModel,
    speechKey, setSpeechKey, speechEndpoint, setSpeechEndpoint,
    aiProvider, setAiProvider, aiModel, setAiModel, aiKey, setAiKey, aiEndpoint, setAiEndpoint,
    attempted, saving, notice, setNotice, stepComplete,
    next, previous, finish,
  };
}
