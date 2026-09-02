/**
 * @file registry.ts
 * @description Maps configured speech, AI, and search providers to protocol adapters.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AiProviderPort,
  ProviderRegistryPort,
  SearchProviderPort,
  SpeechProviderPort,
} from "../domain/providers";
import {
  anthropicProvider,
  customAiProvider,
  googleProvider,
  groqProvider,
  openAiProvider,
  openRouterProvider,
} from "./llm/adapters";
import {
  customSpeechProvider,
  deepgramSpeechProvider,
  googleSpeechProvider,
  groqSpeechProvider,
  openAiSpeechProvider,
  openRouterSpeechProvider,
} from "./stt/adapters";
import { serpApiSearchProvider } from "./search/serpapi";

const speechProviders = new Map<string, SpeechProviderPort>([
  ["custom", customSpeechProvider],
  ["deepgram", deepgramSpeechProvider],
  ["google", googleSpeechProvider],
  ["groq", groqSpeechProvider],
  ["openai", openAiSpeechProvider],
  ["openrouter", openRouterSpeechProvider],
]);

const aiProviders = new Map<string, AiProviderPort>([
  ["claude", anthropicProvider],
  ["custom", customAiProvider],
  ["google", googleProvider],
  ["groq", groqProvider],
  ["openai", openAiProvider],
  ["openrouter", openRouterProvider],
]);

const searchProviders = new Map<string, SearchProviderPort>([
  ["serpapi", serpApiSearchProvider],
]);

export const providerRegistry: ProviderRegistryPort = {
  getSpeech: (providerId) => speechProviders.get(providerId) ?? null,
  getAi: (providerId) => aiProviders.get(providerId) ?? null,
  getSearch: (providerId) => searchProviders.get(providerId) ?? null,
};
