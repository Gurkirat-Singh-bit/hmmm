/**
 * @file vault-runtime.ts
 * @description Provides Vault services with the initialized application database.
 * @author Gurkirat Singh
 * @license MIT
 */

import { openAppDatabase, type AppDatabase } from "@/features/storage/database";

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
