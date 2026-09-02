/**
 * @file preference-store.ts
 * @description Focused SQLite preference persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { AppPreferencesRecord } from "../../domain/contracts";
import { SqliteStore } from "../connection";
import type { PreferencesRepository } from "../contracts";
import {
  defaultPreferences,
  json,
  requireSafeEndpoint,
  requireUtc,
  supportedPreferences,
} from "./store-shared";
export class SqlitePreferencesRepository implements PreferencesRepository {
  constructor(private readonly store: SqliteStore) {}
  async get() {
    const row = await this.store.read((database) =>
      database.getFirstAsync<{ value_json: string }>(
        `SELECT value_json FROM preferences WHERE id = 'app'`,
      ),
    );
    return supportedPreferences(
      row
        ? (JSON.parse(row.value_json) as AppPreferencesRecord)
        : defaultPreferences,
    );
  }
  save(preferences: AppPreferencesRecord) {
    const supported = supportedPreferences(preferences);
    requireUtc(supported.updatedAt);
    if (supported.researchConsent.decidedAt)
      requireUtc(supported.researchConsent.decidedAt);
    requireSafeEndpoint(supported.speechProvider.endpoint);
    requireSafeEndpoint(supported.aiProvider.endpoint);
    return this.store.write(async (database) => {
      await database.runAsync(
        `INSERT INTO preferences (id, value_json, updated_at) VALUES ('app', ?, ?)
         ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        [json(supported), supported.updatedAt],
      );
    });
  }
}
