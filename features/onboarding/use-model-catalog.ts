/**
 * @file use-model-catalog.ts
 * @description React hook for loading and refreshing provider model catalogs.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { cachedModels, CatalogKind, loadModelCatalog } from '@/features/onboarding/model-catalog';
import { ProviderDefinition } from '@/features/onboarding/provider-config';

export function useModelCatalog(kind: CatalogKind, provider: ProviderDefinition, apiKey: string, endpoint: string) {
  const [models, setModels] = useState(() => cachedModels(kind, provider));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const canRefresh = provider.id === 'custom' ? Boolean(endpoint.trim()) : Boolean(provider.modelsUrl);

  const load = useCallback(async (refresh = false) => {
    const currentRequest = ++requestId.current;
    const needsKey = !['none', 'optional-bearer'].includes(provider.authentication);
    if ((needsKey && !apiKey.trim()) || (provider.id === 'custom' && !endpoint.trim())) {
      setModels(cachedModels(kind, provider));
      setError(
        provider.id === 'custom' && !endpoint.trim()
          ? 'Add the provider base URL before searching its model catalog.'
          : `Add your ${provider.label} API key to search its full model catalog.`,
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const discoveredModels = await loadModelCatalog(kind, provider, apiKey, endpoint, refresh);
      if (currentRequest === requestId.current) {
        setModels([...new Set([...provider.starterModels, ...discoveredModels])]);
      }
    } catch (reason) {
      if (currentRequest === requestId.current) {
        setModels(cachedModels(kind, provider));
        setError(reason instanceof Error ? reason.message : 'Could not load models.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [apiKey, endpoint, kind, provider]);

  useEffect(() => {
    setModels(cachedModels(kind, provider));
    setLoading(false);
    const canLoadWithoutCredentials = canRefresh && ['none', 'optional-bearer'].includes(provider.authentication);
    if (!canLoadWithoutCredentials) {
      const needsKey = !['none', 'optional-bearer'].includes(provider.authentication);
      setError(
        provider.id === 'custom' && !endpoint.trim()
          ? 'Add the provider base URL before searching its model catalog.'
          : canRefresh && needsKey && !apiKey.trim()
          ? `Add your ${provider.label} API key to search its full model catalog.`
          : null,
      );
      requestId.current += 1;
      return;
    }
    setError(null);
    const timer = setTimeout(() => void load(), 450);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [canRefresh, kind, load, provider]);

  return { canRefresh, models, loading, error, refresh: () => void load(true) };
}
