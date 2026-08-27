import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { CaptureSort } from '@/features/database/contracts';
import type { CaptureStatus } from '@/features/domain/contracts';

const key = 'hmmm.vault-filters.v1';
const statuses: readonly CaptureStatus[] = ['queued', 'transcribing', 'naming', 'researching', 'ready', 'failed'];
const sorts: readonly CaptureSort[] = ['newest', 'oldest', 'title-asc', 'title-desc'];

export type VaultFilters = Readonly<{
  starredOnly: boolean;
  statuses: readonly CaptureStatus[];
  sort: CaptureSort;
}>;

export const defaultVaultFilters: VaultFilters = { starredOnly: false, statuses: [], sort: 'newest' };

let webFilters: VaultFilters = defaultVaultFilters;

function valid(value: unknown): VaultFilters {
  if (!value || typeof value !== 'object') return defaultVaultFilters;
  const candidate = value as Partial<VaultFilters>;
  return {
    starredOnly: candidate.starredOnly === true,
    statuses: Array.isArray(candidate.statuses)
      ? candidate.statuses.filter((status): status is CaptureStatus => statuses.includes(status as CaptureStatus))
      : [],
    sort: sorts.includes(candidate.sort as CaptureSort) ? candidate.sort as CaptureSort : 'newest',
  };
}

export async function readVaultFilters(): Promise<VaultFilters> {
  if (Platform.OS === 'web') return webFilters;
  try {
    const stored = await SecureStore.getItemAsync(key);
    return stored ? valid(JSON.parse(stored)) : defaultVaultFilters;
  } catch {
    return defaultVaultFilters;
  }
}

export async function saveVaultFilters(filters: VaultFilters): Promise<void> {
  const normalized = valid(filters);
  if (Platform.OS === 'web') {
    webFilters = normalized;
    return;
  }
  await SecureStore.setItemAsync(key, JSON.stringify(normalized));
}
