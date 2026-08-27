import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CaptureRecord, NormalizedError } from '@/features/domain/contracts';
import { normalizeError } from '@/features/domain/errors';

import { getVaultDatabase } from './vault-runtime';
import { defaultVaultFilters, readVaultFilters, saveVaultFilters, type VaultFilters } from './vault-preferences';
import { deleteCaptures, setCaptureStarred, shareCaptures } from './vault-service';

export type VaultCollectionState = Readonly<{
  loading: boolean;
  captures: readonly CaptureRecord[];
  error: NormalizedError | null;
}>;

export function useVaultCollection() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<VaultFilters>(defaultVaultFilters);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [state, setState] = useState<VaultCollectionState>({ loading: true, captures: [], error: null });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    void readVaultFilters().then((stored) => {
      if (!active) return;
      setFilters(stored);
      setPreferencesLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    void saveVaultFilters(filters);
  }, [filters, preferencesLoaded]);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const load = async () => {
      try {
        const database = await getVaultDatabase();
        const captures = await database.repositories.captures.list({
          search: query,
          starred: filters.starredOnly ? true : null,
          statuses: filters.statuses,
          sort: filters.sort,
          limit: null,
          offset: 0,
        });
        if (active) setState({ loading: false, captures, error: null });
      } catch (error) {
        if (active) setState((current) => ({ ...current, loading: false, error: normalizeError(error, 'database') }));
      }
    };
    void getVaultDatabase().then((database) => {
      if (!active) return;
      unsubscribe = database.subscriptions.subscribe((change) => {
        if (change.table === 'captures' || change.table === 'reports') void load();
      });
      void load();
    }).catch((error) => {
      if (active) setState((current) => ({ ...current, loading: false, error: normalizeError(error, 'database') }));
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [filters, preferencesLoaded, query, refreshToken]);

  const toggleStar = useCallback(async (capture: CaptureRecord) => {
    await setCaptureStarred(capture, !capture.starred);
    refresh();
  }, [refresh]);

  const actions = useMemo(() => ({
    toggleStar,
    share: shareCaptures,
    remove: deleteCaptures,
    refresh,
  }), [refresh, toggleStar]);

  return { ...state, query, setQuery, filters, setFilters, actions };
}
