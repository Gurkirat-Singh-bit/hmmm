import { addDatabaseChangeListener, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { LocalDataChange, LocalSubscriptionPort } from '../domain/contracts';
import { DATABASE_NAME, migrateDatabase } from './schema';

const observableTables: Readonly<Record<string, LocalDataChange['table']>> = {
  recording_drafts: 'recording-drafts',
  captures: 'captures',
  reports: 'reports',
  sources: 'sources',
  messages: 'messages',
  discussion_drafts: 'discussion-drafts',
  jobs: 'jobs',
  preferences: 'preferences',
};

export class SqliteStore {
  private writeTail: Promise<void> = Promise.resolve();
  private closePromise: Promise<void> | null = null;

  constructor(readonly database: SQLiteDatabase) {}

  write<Result>(task: (transaction: SQLiteDatabase) => Promise<Result>): Promise<Result> {
    if (this.closePromise) return Promise.reject(new Error('The SQLite store is closing.'));
    const pending = this.writeTail.then(async () => {
      let result!: Result;
      await this.database.withTransactionAsync(async () => {
        result = await task(this.database);
      });
      return result;
    });
    this.writeTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  /** Keeps ordinary reads out of an in-progress application write transaction. */
  read<Result>(task: (database: SQLiteDatabase) => Promise<Result>): Promise<Result> {
    if (this.closePromise) return Promise.reject(new Error('The SQLite store is closing.'));
    const pending = this.writeTail.then(() => task(this.database));
    this.writeTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  readSnapshot<Result>(task: (transaction: SQLiteDatabase) => Promise<Result>): Promise<Result> {
    return this.write(task);
  }

  close(): Promise<void> {
    if (!this.closePromise) this.closePromise = this.writeTail.then(() => this.database.closeAsync());
    return this.closePromise;
  }
}

class SqliteSubscriptions implements LocalSubscriptionPort {
  constructor(private readonly database: SQLiteDatabase) {}

  subscribe(listener: (change: LocalDataChange) => void) {
    const subscription = addDatabaseChangeListener((event) => {
      const table = observableTables[event.tableName];
      if (table && event.databaseFilePath === this.database.databasePath) listener({ table });
    });
    return () => subscription.remove();
  }
}

export type OpenSqliteStore = Readonly<{
  store: SqliteStore;
  subscriptions: LocalSubscriptionPort;
  close: () => Promise<void>;
}>;

export async function openSqliteStore(databaseName = DATABASE_NAME): Promise<OpenSqliteStore> {
  const database = await openDatabaseAsync(databaseName, { enableChangeListener: true });
  await migrateDatabase(database);
  const store = new SqliteStore(database);
  return {
    store,
    subscriptions: new SqliteSubscriptions(database),
    close: () => store.close(),
  };
}
