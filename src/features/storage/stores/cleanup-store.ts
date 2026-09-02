/**
 * @file cleanup-store.ts
 * @description Focused SQLite cleanup persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { SQLiteDatabase } from "expo-sqlite";

import type {
  CleanupQueueRecord,
  NormalizedError,
} from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import { SqliteStore } from "../connection";
import type { CleanupQueueRepository } from "../contracts";
import { CLEANUP_RULES } from "../config";
import { CleanupRow, json, mapCleanup, requireUtc } from "./store-shared";

const maxCleanupAttempts = CLEANUP_RULES.maxAttempts;
export async function insertCleanup(
  database: SQLiteDatabase,
  record: CleanupQueueRecord,
) {
  requireUtc(record.runAfter, record.createdAt, record.updatedAt);
  await database.runAsync(
    `INSERT INTO cleanup_queue (
      id, operation_id, kind, uri, status, attempts, run_after, last_error_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(operation_id, uri) DO NOTHING`,
    [
      record.id,
      record.operationId,
      record.kind,
      record.uri,
      record.status,
      record.attempts,
      record.runAfter,
      record.lastError ? json(record.lastError) : null,
      record.createdAt,
      record.updatedAt,
    ],
  );
  const row = await database.getFirstAsync<CleanupRow>(
    "SELECT * FROM cleanup_queue WHERE operation_id = ? AND uri = ?",
    [record.operationId, record.uri],
  );
  if (!row)
    throw domainError(
      "storage-failed",
      "database",
      "Audio cleanup could not be queued.",
      true,
    );
  return mapCleanup(row);
}
export class SqliteCleanupQueueRepository implements CleanupQueueRepository {
  constructor(private readonly store: SqliteStore) {}
  enqueue(record: CleanupQueueRecord) {
    return this.store.write((database) => insertCleanup(database, record));
  }
  claimNext(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const row = await database.getFirstAsync<CleanupRow>(
        `SELECT * FROM cleanup_queue
         WHERE status IN ('pending', 'retry-wait') AND run_after <= ? AND attempts < ?
         ORDER BY run_after, created_at, id LIMIT 1`,
        [now, maxCleanupAttempts],
      );
      if (!row) return null;
      await database.runAsync(
        `UPDATE cleanup_queue SET status = 'running', attempts = attempts + 1, updated_at = ?
         WHERE id = ? AND status IN ('pending', 'retry-wait')`,
        [now, row.id],
      );
      const claimed = await database.getFirstAsync<CleanupRow>(
        "SELECT * FROM cleanup_queue WHERE id = ?",
        [row.id],
      );
      return claimed ? mapCleanup(claimed) : null;
    });
  }
  complete(id: string) {
    return this.store.write(async (database) => {
      await database.runAsync("DELETE FROM cleanup_queue WHERE id = ?", [id]);
    });
  }
  retry(id: string, runAfter: string, error: NormalizedError) {
    requireUtc(runAfter, error.occurredAt);
    return this.store.write(async (database) => {
      const row = await database.getFirstAsync<CleanupRow>(
        "SELECT * FROM cleanup_queue WHERE id = ?",
        [id],
      );
      if (!row) return;
      await database.runAsync(
        `UPDATE cleanup_queue SET status = ?, run_after = ?, last_error_json = ?, updated_at = ? WHERE id = ?`,
        [
          row.attempts >= maxCleanupAttempts ? "failed" : "retry-wait",
          runAfter,
          json(error),
          error.occurredAt,
          id,
        ],
      );
    });
  }
  fail(id: string, error: NormalizedError) {
    requireUtc(error.occurredAt);
    return this.store.write(async (database) => {
      await database.runAsync(
        `UPDATE cleanup_queue SET status = 'failed', last_error_json = ?, updated_at = ? WHERE id = ?`,
        [json(error), error.occurredAt, id],
      );
    });
  }
  requeueFailed(operationId: string, runAfter: string) {
    requireUtc(runAfter);
    return this.store.write(async (database) => {
      const result = await database.runAsync(
        `UPDATE cleanup_queue SET status = 'pending', run_after = ?, updated_at = ?
         WHERE operation_id = ? AND status = 'failed' AND attempts < ?`,
        [runAfter, runAfter, operationId, maxCleanupAttempts],
      );
      return result.changes;
    });
  }
  async listForOperation(operationId: string) {
    const rows = await this.store.read((database) =>
      database.getAllAsync<CleanupRow>(
        "SELECT * FROM cleanup_queue WHERE operation_id = ? ORDER BY created_at, id",
        [operationId],
      ),
    );
    return rows.map(mapCleanup);
  }
  requeueRunning(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const exhaustedError: NormalizedError = {
        code: "timeout",
        operation: "file-cleanup",
        message: "File cleanup stopped before this item completed.",
        retryable: false,
        occurredAt: now,
        providerId: null,
        statusCode: null,
      };
      const result = await database.runAsync(
        `UPDATE cleanup_queue SET
           status = CASE WHEN attempts >= ? THEN 'failed' ELSE 'pending' END,
           run_after = ?,
           last_error_json = CASE WHEN attempts >= ? THEN ? ELSE last_error_json END,
           updated_at = ?
         WHERE status = 'running'`,
        [
          maxCleanupAttempts,
          now,
          maxCleanupAttempts,
          json(exhaustedError),
          now,
        ],
      );
      return result.changes;
    });
  }
}
