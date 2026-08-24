/**
 * @file model-catalog.ts
 * @description Provider model discovery, parsing, caching, and prefetch utilities.
 * @author Gurkirat Singh
 * @license MIT
 */

import { aiProviders, ProviderDefinition, speechProviders } from '@/features/onboarding/provider-config';

export type CatalogKind = 'speech' | 'ai';

const memoryCache = new Map<string, readonly string[]>();
const activeRequests = new Map<string, Promise<readonly string[]>>();

export function cachedModels(kind: CatalogKind, provider: ProviderDefinition) {
  return memoryCache.get(cacheKey(kind, provider.id)) ?? provider.starterModels;
}

export function prefetchPublicCatalogs() {
  const providers = [
    ...speechProviders.map((provider) => ({ kind: 'speech' as const, provider })),
    ...aiProviders.map((provider) => ({ kind: 'ai' as const, provider })),
  ].filter(({ provider }) => provider.authentication === 'none');
  return Promise.allSettled(providers.map(({ kind, provider }) => loadModelCatalog(kind, provider, '', '')));
}

export function loadModelCatalog(kind: CatalogKind, provider: ProviderDefinition, apiKey: string, customBaseUrl: string, refresh = false) {
  const key = cacheKey(kind, provider.id);
  if (!refresh && memoryCache.has(key)) return Promise.resolve(memoryCache.get(key)!);
  if (!refresh && activeRequests.has(key)) return activeRequests.get(key)!;

  const request = requestCatalog(kind, provider, apiKey, customBaseUrl)
    .then((models) => {
      memoryCache.set(key, models);
      return models;
    })
    .finally(() => activeRequests.delete(key));
  activeRequests.set(key, request);
  return request;
}

async function requestCatalog(kind: CatalogKind, provider: ProviderDefinition, apiKey: string, customBaseUrl: string) {
  const url = resolveModelsUrl(provider, customBaseUrl);
  if (!url) throw new Error('Enter the provider base URL to discover models.');
  const requiresKey = !['none', 'optional-bearer'].includes(provider.authentication);
  if (requiresKey && !apiKey.trim()) throw new Error('Enter the API key to discover models.');

  const response = await fetch(url, { headers: requestHeaders(provider, apiKey.trim()) });
  if (response.status === 401 || response.status === 403) {
    throw new Error('This provider rejected the key. Recommended models are still available below.');
  }
  if (!response.ok) throw new Error(`Could not sync the model catalog (${response.status}).`);
  const models = parseCatalog(await response.json(), provider.id, kind);
  if (!models.length) throw new Error('No compatible models were returned. You can still enter an exact model ID.');
  return models;
}

function resolveModelsUrl(provider: ProviderDefinition, customBaseUrl: string) {
  if (provider.id !== 'custom') return provider.modelsUrl;
  const base = customBaseUrl.trim().replace(/\/+$/, '');
  return base ? `${base}/models` : null;
}

function requestHeaders(provider: ProviderDefinition, apiKey: string): Record<string, string> {
  if (provider.authentication === 'none') return { Accept: 'application/json' };
  if (provider.authentication === 'optional-bearer' && !apiKey) return { Accept: 'application/json' };
  if (provider.authentication === 'anthropic') return { Accept: 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': apiKey };
  if (provider.authentication === 'google') return { Accept: 'application/json', 'x-goog-api-key': apiKey };
  return { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };
}

function parseCatalog(payload: unknown, providerId: string, kind: CatalogKind) {
  if (!isRecord(payload)) return [];
  const ids = providerId === 'deepgram'
    ? readObjectIds(payload.stt, 'canonical_name')
    : providerId === 'google'
      ? readGoogleIds(payload.models)
      : readObjectIds(payload.data, 'id');
  const compatible = providerId === 'deepgram'
    ? ids
    : kind === 'speech'
      ? ids.filter((id) => /audio|speech|transcri|whisper/i.test(id))
      : ids.filter((id) => !/audio|speech|transcri|whisper/i.test(id));
  return [...new Set(compatible)].sort((left, right) => left.localeCompare(right));
}

function readObjectIds(value: unknown, property: string) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => isRecord(item) && typeof item[property] === 'string' ? [item[property]] : []);
}

function readGoogleIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.baseModelId === 'string') return [item.baseModelId];
    return typeof item.name === 'string' ? [item.name.replace(/^models\//, '')] : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cacheKey(kind: CatalogKind, providerId: string) {
  return `${kind}:${providerId}`;
}
