/**
 * @file database.ts
 * @description Opens the singleton SQLite store and assembles focused repositories.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { LocalSubscriptionPort } from "../domain/contracts";
import { openSqliteStore } from "./connection";
import {
  createSqliteRepositories,
  type SqliteRepositories,
} from "./repositories";

export type AppDatabase = Readonly<{
  repositories: SqliteRepositories;
  subscriptions: LocalSubscriptionPort;
  close: () => Promise<void>;
}>;

let appDatabase: AppDatabase | null = null;
let appDatabasePromise: Promise<AppDatabase> | null = null;

/**
 * Keeps every feature on one migrated SQLite connection and write queue for
 * the lifetime of the app. The promise is shared while the connection opens;
 * a failed open is discarded so a later call can retry.
 */
export function openAppDatabase(databaseName?: string): Promise<AppDatabase> {
  if (appDatabase) return Promise.resolve(appDatabase);
  if (appDatabasePromise) return appDatabasePromise;

  const opening = Promise.resolve()
    .then(() => openSqliteStore(databaseName))
    .then((opened) => {
      const repositories = createSqliteRepositories(opened.store);
      let closePromise: Promise<void> | null = null;
      const database: AppDatabase = {
        repositories,
        subscriptions: opened.subscriptions,
        close: () => {
          if (!closePromise) {
            closePromise = opened.close().finally(() => {
              // A stale close must never clear a newer app database.
              if (appDatabase === database) {
                appDatabase = null;
                if (appDatabasePromise === opening) appDatabasePromise = null;
              }
            });
          }
          return closePromise;
        },
      };
      appDatabase = database;
      return database;
    })
    .catch((error) => {
      if (appDatabasePromise === opening) appDatabasePromise = null;
      throw error;
    });

  appDatabasePromise = opening;
  return opening;
}
