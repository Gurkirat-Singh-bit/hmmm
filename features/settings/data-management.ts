import { LocalDataDeletion } from '@/features/database/deletion';
import type { DeletionReceipt, DeleteTarget } from '@/features/domain/contracts';
import { AppOwnedAudioFiles, isAppOwnedAudioUri } from '@/features/recording/audio-storage';
import { getVaultDatabase } from '@/features/vault/vault-runtime';
import { clearSetupMetadata, providerCredentials } from '@/features/onboarding/storage';

function operationId(kind: DeleteTarget['kind']) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${kind}:${Date.now()}:${random}`;
}

async function deleteLocal(target: DeleteTarget): Promise<DeletionReceipt> {
  const database = await getVaultDatabase();
  const deletion = new LocalDataDeletion({
    deletions: database.repositories.deletions,
    cleanup: database.repositories.cleanup,
    secrets: providerCredentials,
    audioFiles: new AppOwnedAudioFiles(),
    isAppOwnedUri: isAppOwnedAudioUri,
  });
  return deletion.execute({ operationId: operationId(target.kind), target, requestedAt: new Date().toISOString() });
}

/** Leaves SQLite preferences and protected credentials in place. */
export function deleteAllIdeas() {
  return deleteLocal({ kind: 'all-ideas' });
}

/** Removes every idea, SQLite preference, legacy setup item, and versioned credential slot. */
export async function fullReset() {
  const receipt = await deleteLocal({ kind: 'full-reset' });
  await clearSetupMetadata();
  return receipt;
}
