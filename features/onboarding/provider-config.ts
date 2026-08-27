/**
 * @file provider-config.ts
 * @description Speech and AI provider definitions used during onboarding.
 * @author Gurkirat Singh
 * @license MIT
 */

/** Describes how a provider is presented and how its model catalog is queried. */
export type ProviderDefinition<Id extends string = string> = {
  id: Id;
  label: string;
  description: string;
  modelsUrl: string | null;
  authentication: 'optional-bearer' | 'bearer' | 'deepgram' | 'anthropic' | 'google' | 'custom';
  starterModels: readonly string[];
};

/** Speech providers supported by the onboarding configuration flow. */
export const speechProviders = [
  { id: 'deepgram', label: 'Deepgram', description: 'Live and saved transcription', modelsUrl: 'https://api.deepgram.com/v1/models', authentication: 'deepgram', starterModels: ['nova-3', 'nova-2', 'whisper'] },
  { id: 'groq', label: 'Groq', description: 'Very fast Whisper transcription', modelsUrl: 'https://api.groq.com/openai/v1/models', authentication: 'bearer', starterModels: ['whisper-large-v3-turbo', 'whisper-large-v3'] },
  { id: 'openai', label: 'OpenAI', description: 'OpenAI speech-to-text models', modelsUrl: 'https://api.openai.com/v1/models', authentication: 'bearer', starterModels: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'] },
  { id: 'openrouter', label: 'OpenRouter', description: 'Dedicated speech-to-text routing', modelsUrl: 'https://openrouter.ai/api/v1/models?output_modalities=transcription', authentication: 'optional-bearer', starterModels: ['openai/gpt-4o-mini-transcribe', 'openai/gpt-4o-transcribe', 'openai/whisper-1'] },
  { id: 'google', label: 'Google Gemini', description: 'Gemini audio transcription', modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', authentication: 'google', starterModels: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'] },
  { id: 'custom', label: 'Custom', description: 'HTTPS OpenAI-compatible endpoint', modelsUrl: null, authentication: 'custom', starterModels: [] },
] as const satisfies readonly ProviderDefinition[];

/** AI providers supported by report generation and discussion. */
export const aiProviders = [
  { id: 'openrouter', label: 'OpenRouter', description: 'One key for hundreds of models', modelsUrl: 'https://openrouter.ai/api/v1/models', authentication: 'optional-bearer', starterModels: ['openrouter/auto'] },
  { id: 'claude', label: 'Claude', description: 'Models directly from Anthropic', modelsUrl: 'https://api.anthropic.com/v1/models', authentication: 'anthropic', starterModels: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'] },
  { id: 'openai', label: 'OpenAI', description: 'Models directly from OpenAI', modelsUrl: 'https://api.openai.com/v1/models', authentication: 'bearer', starterModels: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini'] },
  { id: 'groq', label: 'Groq', description: 'Low-latency open models', modelsUrl: 'https://api.groq.com/openai/v1/models', authentication: 'bearer', starterModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'] },
  { id: 'google', label: 'Google Gemini', description: 'Gemini models from Google', modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', authentication: 'google', starterModels: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'] },
  { id: 'custom', label: 'Custom', description: 'HTTPS OpenAI-compatible endpoint', modelsUrl: null, authentication: 'custom', starterModels: [] },
] as const satisfies readonly ProviderDefinition[];

/** Identifier accepted for a configured speech provider. */
export type SpeechProvider = (typeof speechProviders)[number]['id'];
/** Identifier accepted for a configured AI provider. */
export type AiProvider = (typeof aiProviders)[number]['id'];

/** Default speech provider; its models are still discovered remotely. */
export const defaultSpeechProvider: SpeechProvider = speechProviders[0].id;
/** Default AI provider; its models are still discovered remotely. */
export const defaultAiProvider: AiProvider = aiProviders[0].id;
/** Initial speech model shown before the remote catalog is loaded. */
export const defaultSpeechModel = speechProviders[0].starterModels[0];
/** Initial AI model shown before the remote catalog is loaded. */
export const defaultAiModel = aiProviders[0].starterModels[0];

/** Returns the speech-provider definition for a persisted provider identifier. */
export function findSpeechProvider(id: string | null | undefined) {
  return speechProviders.find((provider) => provider.id === id) ?? speechProviders[0];
}

/** Returns the AI-provider definition for a persisted provider identifier. */
export function findAiProvider(id: string | null | undefined) {
  return aiProviders.find((provider) => provider.id === id) ?? aiProviders[0];
}
