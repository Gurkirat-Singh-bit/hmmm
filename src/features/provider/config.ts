/**
 * @file config.ts
 * @description Provider endpoints, capabilities, timeouts, response limits, and research support rules.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  ProviderCapabilities,
  ProviderDescriptor,
  ProviderKind,
} from "../domain/providers";

export const PROVIDER_ENDPOINTS = {
  anthropic: "https://api.anthropic.com/v1",
  deepgram: "https://api.deepgram.com/v1",
  deepgramLive: "wss://api.deepgram.com/v1/listen",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
} as const;

export const PROVIDER_TIMEOUT_MS = {
  catalog: 15_000,
  probe: 20_000,
  speech: 120_000,
  ai: 90_000,
  discussion: 45_000,
  research: 120_000,
  liveConnect: 15_000,
  liveFinish: 15_000,
} as const;

/** Raw PCM settings that must match the recorder's live chunks. */
export const DEEPGRAM_LIVE_AUDIO = {
  encoding: "linear16",
  sampleRateHz: 16_000,
  channelCount: 1,
  maxBufferedAmount: 256_000,
  bufferDrainTimeoutMs: 2_500,
  bufferPollMs: 25,
} as const;

export const PROVIDER_RETRY = {
  attempts: 2,
  baseDelayMs: 600,
  maxDelayMs: 5_000,
} as const;

export const PROVIDER_CONTEXT_LIMITS = {
  reportTranscriptCharacters: 100_000,
  discussionTranscriptCharacters: 40_000,
  discussionMessages: 24,
  discussionMessageCharacters: 8_000,
} as const;

/** Bounds the editable report instructions stored in local preferences. */
export const SYSTEM_PROMPT_LIMITS = {
  maxCharacters: 6_000,
} as const;

/** Hard ceilings for untrusted provider payloads before parsing or persistence. */
export const PROVIDER_RESPONSE_LIMITS = {
  responseBytes: 2_000_000,
  streamBytes: 2_000_000,
  streamEventCharacters: 128_000,
  structuredDocumentCharacters: 128_000,
  structuredStringCharacters: 16_000,
  reportEvidenceItems: 64,
  reportRiskItems: 64,
  sourceIdsPerEvidence: 32,
  researchCitations: 256,
  researchFindings: 128,
  researchSources: 64,
  sourceTitleCharacters: 1_000,
  sourceUrlCharacters: 2_048,
  findingCharacters: 16_000,
  transcriptCharacters: 100_000,
  transcriptSegments: 5_000,
  catalogModels: 500,
  modelIdCharacters: 256,
} as const;

const noCapabilities: ProviderCapabilities = {
  "speech.file-transcription": false,
  "speech.streaming-transcription": false,
  "ai.report-generation": false,
  "ai.research-with-citations": false,
  "ai.discussion": false,
  "ai.discussion-streaming": false,
};
function descriptor(
  id: string,
  kind: ProviderKind,
  supported: readonly (keyof ProviderCapabilities)[],
): ProviderDescriptor {
  const capabilities = { ...noCapabilities };
  for (const capability of supported) capabilities[capability] = true;
  return { id, kind, capabilities };
}

export const SPEECH_PROVIDER_DESCRIPTORS = {
  custom: descriptor("custom", "speech", ["speech.file-transcription"]),
  deepgram: descriptor("deepgram", "speech", [
    "speech.file-transcription",
    "speech.streaming-transcription",
  ]),
  google: descriptor("google", "speech", ["speech.file-transcription"]),
  groq: descriptor("groq", "speech", ["speech.file-transcription"]),
  openai: descriptor("openai", "speech", ["speech.file-transcription"]),
  openrouter: descriptor("openrouter", "speech", ["speech.file-transcription"]),
} as const;

const aiCapabilities = [
  "ai.report-generation",
  "ai.research-with-citations",
  "ai.discussion",
  "ai.discussion-streaming",
] as const;

export const AI_PROVIDER_DESCRIPTORS = {
  claude: descriptor("claude", "ai", aiCapabilities),
  custom: descriptor("custom", "ai", [
    "ai.report-generation",
    "ai.discussion",
    "ai.discussion-streaming",
  ]),
  google: descriptor("google", "ai", aiCapabilities),
  groq: descriptor("groq", "ai", aiCapabilities),
  openai: descriptor("openai", "ai", aiCapabilities),
  openrouter: descriptor("openrouter", "ai", aiCapabilities),
} as const;

export type SpeechProviderId = keyof typeof SPEECH_PROVIDER_DESCRIPTORS;
export type AiProviderId = keyof typeof AI_PROVIDER_DESCRIPTORS;

const RESEARCH_MODEL_PATTERNS: Readonly<
  Record<Exclude<AiProviderId, "custom">, readonly RegExp[]>
> = {
  claude: [
    /^claude-(?:3-5-haiku|3-7-sonnet)(?:-|$)/i,
    /^claude-(?:haiku|sonnet|opus)-(?:4|5)(?:-|$)/i,
  ],
  google: [/^gemini-(?:2\.5|3)(?:[.-]|$)/i],
  groq: [/^groq\/compound(?:-mini)?$/i],
  openai: [/^(?:gpt-4\.1|gpt-5|o3|o4-mini)(?:[.-]|$)/i],
  openrouter: [
    /^openai\/(?:gpt-4\.1|gpt-5|o3|o4-mini)(?:[.-]|$)/i,
    /^anthropic\/claude-(?:(?:3\.5-haiku|3\.7-sonnet)|(?:haiku|sonnet|opus)-(?:4|5))(?:[.-]|$)/i,
    /^google\/gemini-3(?:[.-]|$)/i,
    /^x-ai\/grok-(?:4|5)(?:[.-]|$)/i,
    /^perplexity\//i,
  ],
};

/** Research calls return an empty, honest result for models outside this allowlist. */
export function supportsProviderResearch(providerId: string, model: string) {
  if (providerId === "custom" || !(providerId in RESEARCH_MODEL_PATTERNS))
    return false;
  // OpenRouter's server-side web search can ground any selected model, using
  // native search when available and a configured search engine otherwise.
  if (providerId === "openrouter") return Boolean(model.trim());
  return RESEARCH_MODEL_PATTERNS[
    providerId as keyof typeof RESEARCH_MODEL_PATTERNS
  ].some((pattern) => pattern.test(model.trim()));
}

/** Explains the native search path used by a selected AI provider and model. */
export function researchProviderDescription(providerId: string, model: string) {
  if (!supportsProviderResearch(providerId, model))
    return "This model has no enabled research path in Hmmmidea.";
  if (providerId === "groq")
    return model.trim().toLowerCase() === "groq/compound-mini"
      ? "Groq Compound Mini may run one server-side web search, then returns the result and automatic citations in one response. Hmmmidea allows only its web-search tool."
      : "Groq Compound decides when to run server-side web searches and may make several tool calls. Hmmmidea allows only its web-search tool and saves the returned sources.";
  if (providerId === "openrouter")
    return "OpenRouter adds its web-search tool to the selected model and returns cited results with the response.";
  if (providerId === "openai")
    return "OpenAI Responses runs its native web-search tool and returns cited sources with the response.";
  if (providerId === "google")
    return "Gemini uses Google Search grounding and returns grounding links with the response.";
  return "Claude uses Anthropic's native web-search tool and returns cited sources with the response.";
}

export function isSpeechProviderId(value: string): value is SpeechProviderId {
  return value in SPEECH_PROVIDER_DESCRIPTORS;
}
export function isAiProviderId(value: string): value is AiProviderId {
  return value in AI_PROVIDER_DESCRIPTORS;
}

/** Returns only response formats supported by the selected transcription API. */
export function transcriptionResponseFormat(
  providerId: "openai" | "groq" | "custom",
  model: string,
) {
  return providerId === "groq" ||
    (providerId === "openai" && model === "whisper-1")
    ? "verbose_json"
    : "json";
}
