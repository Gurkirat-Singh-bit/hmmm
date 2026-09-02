/**
 * @file model-discovery.ts
 * @description Provider model discovery, parsing, caching, and prefetch utilities.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ProviderDefinition } from "@/features/onboarding/provider-config";
import {
  PROVIDER_RESPONSE_LIMITS,
  PROVIDER_TIMEOUT_MS,
} from "@/features/provider/config";
import { readJsonResponse } from "@/features/provider/transport";

export type CatalogKind = "speech" | "ai";

const memoryCache = new Map<string, readonly string[]>();
const activeRequests = new Map<string, Promise<readonly string[]>>();
let deepgramStreamingModels: ReadonlySet<string> | null = null;
export function cachedModels(kind: CatalogKind, provider: ProviderDefinition) {
  return memoryCache.get(cacheKey(kind, provider.id)) ?? provider.starterModels;
}

/**
 * Filters model identifiers using every whitespace-separated search term.
 * Matching is case-insensitive and preserves the provider's catalog order.
 */
export function filterModelCatalog(
  models: readonly string[],
  query: string,
): readonly string[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return models;
  return models.filter((model) => {
    const normalized = model.toLowerCase();
    return terms.every((term) => normalized.includes(term));
  });
}

/** Kept temporarily for the existing root caller; startup catalog networking is intentionally disabled. */
export function prefetchPublicCatalogs() {
  return Promise.resolve([]);
}
export function loadModelCatalog(
  kind: CatalogKind,
  provider: ProviderDefinition,
  apiKey: string,
  customBaseUrl: string,
  refresh = false,
) {
  const key = cacheKey(kind, provider.id, customBaseUrl);
  if (!refresh && memoryCache.has(key))
    return Promise.resolve(memoryCache.get(key)!);
  if (!refresh && activeRequests.has(key)) return activeRequests.get(key)!;

  const request = requestCatalog(kind, provider, apiKey)
    .then((models) => {
      memoryCache.set(key, models);
      return models;
    })
    .finally(() => activeRequests.delete(key));
  activeRequests.set(key, request);
  return request;
}

/** Confirms live support from Deepgram metadata instead of guessing from the model name. */
export async function deepgramModelSupportsStreaming(
  provider: ProviderDefinition,
  apiKey: string,
  model: string,
) {
  if (provider.id !== "deepgram" || !apiKey.trim() || !model.trim())
    return false;
  try {
    await loadModelCatalog("speech", provider, apiKey, "");
    return deepgramStreamingModels?.has(model.trim()) ?? false;
  } catch {
    return false;
  }
}
async function requestCatalog(
  kind: CatalogKind,
  provider: ProviderDefinition,
  apiKey: string,
) {
  const url = resolveModelsUrl(provider);
  if (!url) throw new Error("This provider needs an explicit model ID.");
  const requiresKey = provider.authentication !== "optional-bearer";
  if (requiresKey && !apiKey.trim())
    throw new Error("Enter the API key to discover models.");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PROVIDER_TIMEOUT_MS.catalog,
  );
  try {
    const response = await fetch(url, {
      headers: requestHeaders(provider, apiKey.trim()),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "This provider rejected the key. Recommended models are still available below.",
      );
    }
    if (!response.ok)
      throw new Error(`Could not sync the model catalog (${response.status}).`);
    const payload = await readJsonResponse(
      response,
      provider.id,
      "provider-configuration",
    );
    const models = parseModelCatalog(payload, provider.id, kind);
    if (!models.length)
      throw new Error(
        "No compatible models were returned. You can still enter an exact model ID.",
      );
    if (provider.id === "deepgram" && kind === "speech")
      deepgramStreamingModels = new Set(
        parseDeepgramStreamingModelIds(payload),
      );
    return models;
  } catch (reason) {
    if (reason instanceof Error && reason.name === "AbortError")
      throw new Error("The model catalog request timed out.");
    if (
      reason instanceof Error &&
      [
        "Enter the API key to discover models.",
        "This provider rejected the key. Recommended models are still available below.",
        "No compatible models were returned. You can still enter an exact model ID.",
      ].includes(reason.message)
    )
      throw reason;
    if (
      reason instanceof Error &&
      reason.message.startsWith("Could not sync the model catalog (")
    )
      throw reason;
    throw new Error(
      "Could not sync the model catalog. Check the connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns every exact identifier for Deepgram STT entries marked streaming-capable. */
export function parseDeepgramStreamingModelIds(payload: unknown) {
  if (!isRecord(payload)) return [];
  return [
    ...new Set(
      boundedCatalogItems(payload.stt).flatMap((item) => {
        if (!isRecord(item) || item.streaming !== true) return [];
        return [item.canonical_name, item.name, item.uuid].filter(
          (value): value is string =>
            typeof value === "string" &&
            value.length > 0 &&
            value.length <= PROVIDER_RESPONSE_LIMITS.modelIdCharacters,
        );
      }),
    ),
  ];
}
function resolveModelsUrl(provider: ProviderDefinition) {
  if (provider.id === "custom") return null;
  return provider.modelsUrl;
}
function requestHeaders(
  provider: ProviderDefinition,
  apiKey: string,
): Record<string, string> {
  if (provider.authentication === "optional-bearer" && !apiKey)
    return { Accept: "application/json" };
  if (provider.authentication === "deepgram")
    return { Accept: "application/json", Authorization: `Token ${apiKey}` };
  if (provider.authentication === "anthropic")
    return {
      Accept: "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  if (provider.authentication === "google")
    return { Accept: "application/json", "x-goog-api-key": apiKey };
  return { Accept: "application/json", Authorization: `Bearer ${apiKey}` };
}

/** Filters and bounds an untrusted provider catalog for the requested capability. */
export function parseModelCatalog(
  payload: unknown,
  providerId: string,
  kind: CatalogKind,
) {
  if (!isRecord(payload)) return [];
  const ids =
    providerId === "deepgram"
      ? readObjectIds(payload.stt, "canonical_name")
      : providerId === "google"
        ? readGoogleIds(payload.models)
        : readObjectIds(payload.data, "id");
  const compatible =
    providerId === "deepgram"
      ? ids
      : providerId === "openrouter" && kind === "speech"
        ? ids
        : providerId === "openrouter"
          ? readOpenRouterTextIds(payload.data)
          : providerId === "openai" && kind === "ai"
            ? ids.filter((id) => /^(?:gpt-|o\d|chatgpt-)/i.test(id))
            : providerId === "groq" && kind === "ai"
              ? ids.filter(
                  (id) => !/audio|speech|transcri|whisper|tts|playai/i.test(id),
                )
              : kind === "speech"
                ? ids.filter((id) => /audio|speech|transcri|whisper/i.test(id))
                : ids.filter(
                    (id) => !/audio|speech|transcri|whisper|tts/i.test(id),
                  );
  const models = [...new Set(compatible)];
  if (models.length > PROVIDER_RESPONSE_LIMITS.catalogModels)
    throw new Error(
      "Could not sync the model catalog. The provider returned too many models.",
    );
  return models.sort((left, right) => left.localeCompare(right));
}
function readObjectIds(value: unknown, property: string) {
  return boundedCatalogItems(value).flatMap((item) => {
    if (!isRecord(item) || typeof item[property] !== "string") return [];
    return item[property].length <= PROVIDER_RESPONSE_LIMITS.modelIdCharacters
      ? [item[property]]
      : [];
  });
}
function readGoogleIds(value: unknown) {
  return boundedCatalogItems(value).flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      Array.isArray(item.supportedGenerationMethods) &&
      !item.supportedGenerationMethods.includes("generateContent")
    )
      return [];
    if (typeof item.baseModelId === "string")
      return item.baseModelId.length <=
        PROVIDER_RESPONSE_LIMITS.modelIdCharacters
        ? [item.baseModelId]
        : [];
    if (typeof item.name !== "string") return [];
    const id = item.name.replace(/^models\//, "");
    return id.length <= PROVIDER_RESPONSE_LIMITS.modelIdCharacters ? [id] : [];
  });
}
function readOpenRouterTextIds(value: unknown) {
  return boundedCatalogItems(value).flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string") return [];
    if (item.id.length > PROVIDER_RESPONSE_LIMITS.modelIdCharacters) return [];
    if (
      !isRecord(item.architecture) ||
      !Array.isArray(item.architecture.output_modalities)
    )
      return [item.id];
    return item.architecture.output_modalities.includes("text")
      ? [item.id]
      : [];
  });
}
function boundedCatalogItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > PROVIDER_RESPONSE_LIMITS.catalogModels) {
    throw new Error(
      "Could not sync the model catalog. The provider returned too many models.",
    );
  }
  return value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cacheKey(kind: CatalogKind, providerId: string, endpoint = "") {
  return `${kind}:${providerId}:${providerId === "custom" ? endpoint.trim() : ""}`;
}
