import type { AiProviderPort, ProviderRegistryPort, SpeechProviderPort } from '../domain/providers';
import {
  anthropicProvider,
  customAiProvider,
  googleProvider,
  groqProvider,
  openAiProvider,
  openRouterProvider,
} from './ai';
import {
  customSpeechProvider,
  deepgramSpeechProvider,
  googleSpeechProvider,
  groqSpeechProvider,
  openAiSpeechProvider,
  openRouterSpeechProvider,
} from './speech';

const speechProviders = new Map<string, SpeechProviderPort>([
  ['custom', customSpeechProvider],
  ['deepgram', deepgramSpeechProvider],
  ['google', googleSpeechProvider],
  ['groq', groqSpeechProvider],
  ['openai', openAiSpeechProvider],
  ['openrouter', openRouterSpeechProvider],
]);

const aiProviders = new Map<string, AiProviderPort>([
  ['claude', anthropicProvider],
  ['custom', customAiProvider],
  ['google', googleProvider],
  ['groq', groqProvider],
  ['openai', openAiProvider],
  ['openrouter', openRouterProvider],
]);

export const providerRegistry: ProviderRegistryPort = {
  getSpeech: (providerId) => speechProviders.get(providerId) ?? null,
  getAi: (providerId) => aiProviders.get(providerId) ?? null,
};
