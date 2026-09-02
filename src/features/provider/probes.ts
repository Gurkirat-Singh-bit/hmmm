/**
 * @file probes.ts
 * @description Minimal authenticated provider checks used when saving configuration.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { ProviderContext } from "../domain/providers";
import {
  PROVIDER_TIMEOUT_MS,
  isAiProviderId,
  isSpeechProviderId,
} from "./config";
import { isRecord } from "./parsing";
import {
  providerBaseUrl,
  providerError,
  requestHeaders,
  requestJson,
  requestProbe,
  requireProviderContext,
} from "./transport";

export type ProviderProbeResult = Readonly<{
  kind: "speech" | "ai";
  providerId: string;
  model: string;
  checkedAt: string;
  latencyMs: number;
}>;
export async function probeSpeechProvider(
  context: ProviderContext,
): Promise<ProviderProbeResult> {
  if (!isSpeechProviderId(context.selection.providerId)) {
    throw providerError(
      "unsupported",
      "provider-configuration",
      context.selection.providerId,
      "This speech provider is not supported.",
    );
  }
  const providerId = context.selection.providerId;
  const startedAt = Date.now();
  const { apiKey, model } = requireProviderContext(context, providerId);
  const base = providerBaseUrl(context, providerId);
  const requestId = `probe-speech-${startedAt}`;

  if (providerId === "custom") {
    const form = new FormData();
    form.append("file", new Blob([], { type: "audio/wav" }), "probe.wav");
    form.append("model", model);
    await requestProbe(
      {
        providerId,
        operation: "provider-configuration",
        url: `${base}/audio/transcriptions`,
        init: {
          method: "POST",
          headers: requestHeaders(providerId, apiKey, requestId, false),
          body: form,
        },
        timeoutMs: PROVIDER_TIMEOUT_MS.probe,
        attempts: 1,
      },
      [400, 415, 422],
    );
  } else if (providerId === "groq") {
    const payload = await requestJson({
      providerId,
      operation: "provider-configuration",
      url: `${base}/models`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    requireCatalogModel(payload, model, providerId, "speech");
  } else {
    await requestProbe({
      providerId,
      operation: "provider-configuration",
      url:
        providerId === "google"
          ? `${base}/models/${encodeURIComponent(model)}`
          : `${base}/models${providerId === "openrouter" ? "?output_modalities=transcription" : ""}`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
  }
  return probeResult("speech", providerId, model, startedAt);
}
export async function probeAiProvider(
  context: ProviderContext,
): Promise<ProviderProbeResult> {
  if (!isAiProviderId(context.selection.providerId)) {
    throw providerError(
      "unsupported",
      "provider-configuration",
      context.selection.providerId,
      "This AI provider is not supported.",
    );
  }
  const providerId = context.selection.providerId;
  const startedAt = Date.now();
  const { apiKey, model } = requireProviderContext(context, providerId);
  const base = providerBaseUrl(context, providerId);
  const requestId = `probe-ai-${startedAt}`;
  if (providerId === "openrouter") {
    await requestProbe({
      providerId,
      operation: "provider-configuration",
      url: `${base}/chat/completions`,
      init: {
        method: "POST",
        headers: requestHeaders(providerId, apiKey, requestId),
        body: JSON.stringify({
          model,
          max_completion_tokens: 16,
          messages: [{ role: "user", content: "Reply with OK." }],
        }),
      },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    return probeResult("ai", providerId, model, startedAt);
  }
  if (providerId === "groq") {
    const payload = await requestJson({
      providerId,
      operation: "provider-configuration",
      url: `${base}/models`,
      init: { headers: requestHeaders(providerId, apiKey, requestId) },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
    });
    requireCatalogModel(payload, model, providerId, "AI");
    return probeResult("ai", providerId, model, startedAt);
  }
  const custom = providerId === "custom";
  const url = custom
    ? `${base}/chat/completions`
    : `${base}/models/${encodeURIComponent(model)}`;
  await requestProbe({
    providerId,
    operation: "provider-configuration",
    url,
    init: custom
      ? {
          method: "POST",
          headers: requestHeaders(providerId, apiKey, requestId),
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: "user", content: "Reply OK." }],
          }),
        }
      : { headers: requestHeaders(providerId, apiKey, requestId) },
    timeoutMs: PROVIDER_TIMEOUT_MS.probe,
    attempts: 1,
  });
  return probeResult("ai", providerId, model, startedAt);
}
export function probeSelectedProviders(
  input: Readonly<{ speech: ProviderContext; ai: ProviderContext }>,
) {
  return Promise.all([
    probeSpeechProvider(input.speech),
    probeAiProvider(input.ai),
  ]).then(([speech, ai]) => ({ speech, ai }));
}
function probeResult(
  kind: "speech" | "ai",
  providerId: string,
  model: string,
  startedAt: number,
) {
  return {
    kind,
    providerId,
    model,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  } as const;
}
function requireCatalogModel(
  payload: unknown,
  model: string,
  providerId: string,
  kind: "speech" | "AI",
) {
  const models =
    isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  if (models.some((entry) => isRecord(entry) && entry.id === model)) return;
  throw providerError(
    "unsupported",
    "provider-configuration",
    providerId,
    `The selected Groq ${kind} model is not currently available.`,
  );
}
