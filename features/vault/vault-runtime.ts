import { openAppDatabase, type AppDatabase } from '@/features/database/database';

let databasePromise: Promise<AppDatabase> | null = null;

/** One app-lifetime SQLite handle keeps Vault reads and local change events coherent. */
export function getVaultDatabase() {
  if (!databasePromise) {
    databasePromise = openAppDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}
