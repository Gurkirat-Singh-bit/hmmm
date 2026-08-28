import type { ProviderContext } from '../domain/providers';
import {
  PROVIDER_TIMEOUT_MS,
  isAiProviderId,
  isSpeechProviderId,
  type AiProviderId,
  type SpeechProviderId,
} from './config';
import { isRecord } from './parsing';
import {
  providerBaseUrl,
  providerError,
  requestHeaders,
  requestJson,
  requestProbe,
  requireProviderContext,
} from './transport';

export type ProviderProbeResult = Readonly<{
  kind: 'speech' | 'ai';
  providerId: string;
  model: string;
  checkedAt: string;
  latencyMs: number;
}>;

export async function probeSpeechProvider(context: ProviderContext): Promise<ProviderProbeResult> {
  if (!isSpeechProviderId(context.selection.providerId)) {
    throw providerError('unsupported', 'provider-configuration', context.selection.providerId, 'This speech provider is not supported.');
  }
  const providerId = context.selection.providerId;
  const startedAt = Date.now();
  const { apiKey, model } = requireProviderContext(context, providerId);
  const base = providerBaseUrl(context, providerId);
  const requestId = `probe-speech-${startedAt}`;

  if (providerId === 'custom') {
    const form = new FormData();
    form.append('file', new Blob([], { type: 'audio/wav' }), 'probe.wav');
    form.append('model', model);
    await requestProbe({
      providerId,
      operation: 'provider-configuration',
      url: `${base}/audio/transcriptions`,
      init: { method: 'POST', headers: requestHeaders(providerId, apiKey, requestId, false), body: form },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    }, [400, 415, 422]);
  } else if (providerId === 'google') {
    await requestJson({
      providerId,
      operation: 'provider-configuration',
      url: `${base}/models/${encodeURIComponent(model)}`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
  } else {
    const payload = await requestJson({
      providerId,
      operation: 'provider-configuration',
      url: `${base}/models${providerId === 'openrouter' ? '?output_modalities=transcription' : ''}`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    if (!catalogContainsModel(payload, providerId, model)) {
      throw providerError('unsupported', 'provider-configuration', providerId, 'The selected speech model was not found for this provider.');
    }
  }
  return probeResult('speech', providerId, model, startedAt);
}

export async function probeAiProvider(context: ProviderContext): Promise<ProviderProbeResult> {
  if (!isAiProviderId(context.selection.providerId)) {
    throw providerError('unsupported', 'provider-configuration', context.selection.providerId, 'This AI provider is not supported.');
  }
  const providerId = context.selection.providerId;
  const startedAt = Date.now();
  const { apiKey, model } = requireProviderContext(context, providerId);
  const base = providerBaseUrl(context, providerId);
  const requestId = `probe-ai-${startedAt}`;
  if (providerId === 'openrouter') {
    await requestProbe({
      providerId,
      operation: 'provider-configuration',
      url: `${base}/key`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    const payload = await requestJson({
      providerId,
      operation: 'provider-configuration',
      url: `${base}/models`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    if (!isOpenRouterRoute(model) && !catalogContainsModel(payload, providerId, model)) {
      throw providerError('unsupported', 'provider-configuration', providerId, 'OpenRouter does not list the selected model. Choose it again from the catalog.');
    }
    return probeResult('ai', providerId, model, startedAt);
  }
  const url = providerId === 'openai'
    ? `${base}/responses`
    : providerId === 'google'
      ? `${base}/models/${encodeURIComponent(model)}:generateContent`
      : providerId === 'claude'
        ? `${base}/messages`
        : `${base}/chat/completions`;
  await requestProbe({
    providerId,
    operation: 'provider-configuration',
    url,
    init: {
      method: 'POST',
      headers: requestHeaders(providerId, apiKey, requestId),
      body: JSON.stringify(probeAiBody(providerId, model)),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.probe,
    attempts: 1,
  });
  return probeResult('ai', providerId, model, startedAt);
}

export function probeSelectedProviders(input: Readonly<{ speech: ProviderContext; ai: ProviderContext }>) {
  return Promise.all([
    probeSpeechProvider(input.speech),
    probeAiProvider(input.ai),
  ]).then(([speech, ai]) => ({ speech, ai }));
}

function probeAiBody(providerId: AiProviderId, model: string) {
  if (providerId === 'openai') return { model, input: 'Reply OK.', max_output_tokens: 8 };
  if (providerId === 'google') {
    return {
      contents: [{ role: 'user', parts: [{ text: 'Reply OK.' }] }],
      generationConfig: { maxOutputTokens: 1 },
    };
  }
  if (providerId === 'claude') {
    return { model, max_tokens: 1, messages: [{ role: 'user', content: 'Reply OK.' }] };
  }
  return { model, max_tokens: 1, messages: [{ role: 'user', content: 'Reply OK.' }] };
}

function catalogContainsModel(payload: unknown, providerId: string, model: string) {
  if (!isRecord(payload)) return false;
  const values = providerId === 'deepgram' ? payload.stt : payload.data;
  if (!Array.isArray(values)) return false;
  return values.some((value) => {
    if (!isRecord(value)) return false;
    const id = providerId === 'deepgram' ? value.canonical_name : value.id;
    return id === model;
  });
}

function isOpenRouterRoute(model: string) {
  return model === 'openrouter/auto' || model === 'openrouter/free';
}

function probeResult(kind: 'speech' | 'ai', providerId: string, model: string, startedAt: number) {
  return {
    kind,
    providerId,
    model,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  } as const;
}
