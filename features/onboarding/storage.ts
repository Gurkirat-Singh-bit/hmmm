import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type OnboardingProfile = {
  name: string;
  speechProvider: string;
  speechModel: string;
  speechKey: string;
  aiProvider: string;
  aiModel: string;
  aiKey: string;
};

const keys = {
  complete: 'hmmm.onboarding-complete', name: 'hmmm.profile-name',
  speechProvider: 'hmmm.speech-provider', speechModel: 'hmmm.speech-model', speech: 'hmmm.speech-key',
  aiProvider: 'hmmm.ai-provider', aiModel: 'hmmm.ai-model', ai: 'hmmm.ai-key',
} as const;

let webSessionProfile: OnboardingProfile | null = null;
const onboardingVersion = '2';

async function readNative(key: string) {
  return Platform.OS === 'web' ? null : SecureStore.getItemAsync(key);
}

export async function isOnboardingComplete() {
  return Platform.OS === 'web'
    ? webSessionProfile !== null
    : (await readNative(keys.complete)) === onboardingVersion;
}

export async function readProfile(): Promise<OnboardingProfile | null> {
  if (Platform.OS === 'web') return webSessionProfile;
  const [name, speechProvider, speechModel, speechKey, aiProvider, aiModel, aiKey] = await Promise.all([
    readNative(keys.name), readNative(keys.speechProvider), readNative(keys.speechModel), readNative(keys.speech),
    readNative(keys.aiProvider), readNative(keys.aiModel), readNative(keys.ai),
  ]);
  return name ? {
    name,
    speechProvider: speechProvider ?? 'Deepgram', speechModel: speechModel ?? 'nova-3', speechKey: speechKey ?? '',
    aiProvider: aiProvider ?? 'OpenRouter', aiModel: aiModel ?? 'google/gemini-2.5-flash', aiKey: aiKey ?? '',
  } : null;
}

export async function saveProfile(profile: OnboardingProfile) {
  if (Platform.OS === 'web') {
    webSessionProfile = profile;
    return;
  }
  await Promise.all([
    SecureStore.setItemAsync(keys.name, profile.name),
    SecureStore.setItemAsync(keys.speechProvider, profile.speechProvider),
    SecureStore.setItemAsync(keys.speechModel, profile.speechModel),
    SecureStore.setItemAsync(keys.speech, profile.speechKey),
    SecureStore.setItemAsync(keys.aiProvider, profile.aiProvider),
    SecureStore.setItemAsync(keys.aiModel, profile.aiModel),
    SecureStore.setItemAsync(keys.ai, profile.aiKey),
    SecureStore.setItemAsync(keys.complete, onboardingVersion),
  ]);
}
