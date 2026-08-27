/** State and secure completion flow for the three-step Android onboarding. */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { RecordingPermission, ResearchConsent } from '@/features/domain/contracts';
import {
  defaultAiModel,
  defaultAiProvider,
  defaultSpeechModel,
  defaultSpeechProvider,
  findAiProvider,
  findSpeechProvider,
  type AiProvider,
  type SpeechProvider,
} from '@/features/onboarding/provider-config';
import { readProfile, saveProfile } from '@/features/onboarding/storage';
import { probeSelectedProviders } from '@/features/providers/probes';
import { SiteedRecordingAdapter } from '@/features/recording/siteed-recording';

export const onboardingStepCount = 3;
export type OnboardingStep = 0 | 1 | 2;
export type OnboardingNotice = { title: string; body: string } | null;
type ResearchDecision = Exclude<ResearchConsent['status'], 'unknown'> | 'unknown';

export function useOnboardingFlow() {
  const router = useRouter();
  const recorder = useMemo(() => new SiteedRecordingAdapter(), []);
  const [step, setStep] = useState<OnboardingStep>(0);
  const [name, setName] = useState('');
  const [microphonePermission, setMicrophonePermission] = useState<RecordingPermission>('undetermined');
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>(defaultSpeechProvider);
  const [speechModel, setSpeechModel] = useState<string>(defaultSpeechModel);
  const [speechKey, setSpeechKey] = useState('');
  const [speechEndpoint, setSpeechEndpoint] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>(defaultAiProvider);
  const [aiModel, setAiModel] = useState<string>(defaultAiModel);
  const [aiKey, setAiKey] = useState('');
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [researchConsent, setResearchConsent] = useState<ResearchDecision>('unknown');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<OnboardingNotice>(null);

  useEffect(() => {
    void Promise.all([readProfile(), recorder.getPermission().catch(() => 'undetermined' as const)]).then(([profile, permission]) => {
      setMicrophonePermission(permission);
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
    }).catch(() => setNotice({ title: 'Setup needs Android storage', body: 'Open Hmmmidea in an Android development build, then try again.' }));
  }, [recorder]);

  const stepComplete =
    step === 0 ? Boolean(name.trim() && microphonePermission === 'granted') :
      step === 1 ? Boolean(speechKey.trim() && speechModel.trim() && (speechProvider !== 'custom' || speechEndpoint.trim())) :
        Boolean(aiKey.trim() && aiModel.trim() && (aiProvider !== 'custom' || aiEndpoint.trim()) && researchConsent !== 'unknown');

  const moveTo = (nextStep: OnboardingStep) => {
    setAttempted(false);
    setStep(nextStep);
  };

  const requestMicrophone = async () => {
    try {
      const current = await recorder.getPermission();
      const permission = current === 'granted' ? current : await recorder.requestPermission();
      setMicrophonePermission(permission);
      if (permission !== 'granted') {
        setNotice({ title: 'Microphone access is needed', body: 'Allow microphone access in Android settings so Hmmmidea can capture an idea.' });
      }
      return permission === 'granted';
    } catch {
      setNotice({ title: 'Microphone unavailable', body: 'Hmmmidea needs an Android development build with recording support before you can continue.' });
      return false;
    }
  };

  const next = async () => {
    const microphoneGranted = step === 0 && microphonePermission !== 'granted'
      ? await requestMicrophone()
      : microphonePermission === 'granted';
    const complete = step === 0 ? Boolean(name.trim() && microphoneGranted) : stepComplete;
    if (!complete) {
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
    const speech = { providerId: speechProvider, model: speechModel.trim(), endpoint: speechEndpoint.trim() || null };
    const ai = { providerId: aiProvider, model: aiModel.trim(), endpoint: aiEndpoint.trim() || null };
    try {
      await probeSelectedProviders({
        speech: { selection: speech, apiKey: speechKey.trim() },
        ai: { selection: ai, apiKey: aiKey.trim() },
      });
      await saveProfile({
        name, speechProvider, speechModel, speechKey, speechEndpoint, aiProvider, aiModel, aiKey, aiEndpoint,
      }, {
        onboardingComplete: true,
        researchEnabled: true,
        researchConsent: researchConsent as Exclude<ResearchConsent['status'], 'unknown'>,
      });
      router.replace('/');
    } catch {
      setNotice({ title: 'Check both provider connections', body: 'Hmmmidea could not verify the selected speech and AI setups. Check each key, model, endpoint, and connection, then try again.' });
    } finally {
      setSaving(false);
    }
  };

  return {
    step, name, setName, microphonePermission, requestMicrophone,
    speechProvider, setSpeechProvider, speechModel, setSpeechModel, speechKey, setSpeechKey, speechEndpoint, setSpeechEndpoint,
    aiProvider, setAiProvider, aiModel, setAiModel, aiKey, setAiKey, aiEndpoint, setAiEndpoint,
    researchConsent, setResearchConsent,
    attempted, saving, notice, setNotice, stepComplete,
    next, previous, finish,
  };
}
