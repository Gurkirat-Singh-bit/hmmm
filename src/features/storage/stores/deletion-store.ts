/**
 * @file deletion-store.ts
 * @description Focused SQLite deletion persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { SQLiteDatabase } from "expo-sqlite";

import type {
  DeletionReceipt,
  DeletionRequest,
  DeletionTombstoneRecord,
  NormalizedError,
} from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import { SqliteStore } from "../connection";
import type { DeletionRepository } from "../contracts";
import { insertCleanup } from "./cleanup-store";
import {
  CleanupRow,
  currentGeneration,
  json,
  parse,
  requireUtc,
} from "./store-shared";

type TombstoneRow = {
  operation_id: string;
  target_kind: DeletionRequest["target"]["kind"];
  capture_id: string | null;
  generation: number;
  secure_data: DeletionReceipt["secureData"];
  created_at: string;
};
function mapTarget(row: TombstoneRow): DeletionRequest["target"] {
  return row.target_kind === "capture"
    ? { kind: "capture", captureId: row.capture_id! }
    : { kind: row.target_kind };
}
function mapTombstone(row: TombstoneRow): DeletionTombstoneRecord {
  return {
    operationId: row.operation_id,
    target: mapTarget(row),
    generation: row.generation,
    createdAt: row.created_at,
  };
}
async function deletionReceipt(
  database: SQLiteDatabase,
  operationId: string,
): Promise<DeletionReceipt | null> {
  const tombstone = await database.getFirstAsync<TombstoneRow>(
    "SELECT * FROM deletion_tombstones WHERE operation_id = ?",
    [operationId],
  );
  if (!tombstone) return null;
  const cleanup = await database.getAllAsync<CleanupRow>(
    "SELECT * FROM cleanup_queue WHERE operation_id = ? ORDER BY created_at, id",
    [operationId],
  );
  return {
    operationId,
    target: mapTarget(tombstone),
    structuredDataDeleted: true,
    secureData: tombstone.secure_data,
    pendingAudioUris: cleanup
      .filter((row) => row.status !== "failed")
      .map((row) => row.uri),
    failedAudioUris: cleanup.flatMap((row) => {
      const error = parse<NormalizedError>(row.last_error_json);
      return row.status === "failed" && error ? [{ uri: row.uri, error }] : [];
    }),
  };
}
async function audioUris(
  database: SQLiteDatabase,
  captureId?: string,
  additionalAudioUris: readonly string[] = [],
) {
  const captureRows = await database.getAllAsync<{ audio_json: string | null }>(
    captureId
      ? "SELECT audio_json FROM captures WHERE id = ?"
      : "SELECT audio_json FROM captures",
    captureId ? [captureId] : [],
  );
  const draftRows = captureId
    ? []
    : await database.getAllAsync<{ audio_json: string | null }>(
        "SELECT audio_json FROM recording_drafts",
      );
  const queuedRows = captureId
    ? []
    : await database.getAllAsync<{ uri: string }>(
        "SELECT uri FROM cleanup_queue",
      );
  return [
    ...new Set([
      ...additionalAudioUris,
      ...[...captureRows, ...draftRows].flatMap((row) => {
        const audio = parse<{ uri: string }>(row.audio_json);
        return audio?.uri ? [audio.uri] : [];
      }),
      ...queuedRows.map((row) => row.uri),
    ]),
  ];
}
export class SqliteDeletionRepository implements DeletionRepository {
  constructor(private readonly store: SqliteStore) {}
  getGeneration() {
    return this.store.read((database) => currentGeneration(database));
  }
  async getTombstone(operationId: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<TombstoneRow>(
        "SELECT * FROM deletion_tombstones WHERE operation_id = ?",
        [operationId],
      ),
    );
    return row ? mapTombstone(row) : null;
  }
  stage(request: DeletionRequest, additionalAudioUris: readonly string[] = []) {
    requireUtc(request.requestedAt);
    return this.store.write(async (database) => {
      const existing = await deletionReceipt(database, request.operationId);
      if (existing) {
        if (json(existing.target) !== json(request.target)) {
          throw domainError(
            "conflict",
            "database",
            "This deletion operation already has another target.",
          );
        }
        return existing;
      }
      const uris = await audioUris(
        database,
        request.target.kind === "capture"
          ? request.target.captureId
          : undefined,
        additionalAudioUris,
      );
      const generation = await currentGeneration(database);
      const nextGeneration =
        request.target.kind === "capture" ? generation : generation + 1;
      if (request.target.kind === "full-reset") {
        await database.runAsync("DELETE FROM cleanup_queue");
      }
      await database.runAsync(
        `INSERT INTO deletion_tombstones (
          operation_id, target_kind, capture_id, generation, secure_data, created_at
        ) VALUES (?, ?, ?, ?, 'not-applicable', ?)`,
        [
          request.operationId,
          request.target.kind,
          request.target.kind === "capture" ? request.target.captureId : null,
          nextGeneration,
          request.requestedAt,
        ],
      );
      for (const uri of uris) {
        await insertCleanup(database, {
          id: `cleanup:${json([request.operationId, uri])}`,
          operationId: request.operationId,
          kind: "delete-audio",
          uri,
          status: "pending",
          attempts: 0,
          runAfter: request.requestedAt,
          lastError: null,
          createdAt: request.requestedAt,
          updatedAt: request.requestedAt,
        });
      }
      if (request.target.kind === "capture") {
        await database.runAsync(
          `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
           WHERE capture_id = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')`,
          [request.requestedAt, request.requestedAt, request.target.captureId],
        );
        await database.runAsync("DELETE FROM captures WHERE id = ?", [
          request.target.captureId,
        ]);
      } else {
        await database.runAsync(
          `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
           WHERE status NOT IN ('succeeded', 'failed', 'cancelled')`,
          [request.requestedAt, request.requestedAt],
        );
        await database.runAsync("DELETE FROM captures");
        await database.runAsync("DELETE FROM recording_drafts");
        if (request.target.kind === "full-reset")
          await database.runAsync("DELETE FROM preferences");
      }
      // Keep the old generation visible until cascades/cancellations finish;
      // the transaction makes the increment and deletion one atomic barrier.
      if (nextGeneration !== generation) {
        await database.runAsync(
          "UPDATE data_generation SET generation = ? WHERE id = 1",
          [nextGeneration],
        );
      }
      return (await deletionReceipt(database, request.operationId))!;
    });
  }
  receipt(operationId: string) {
    return this.store.read((database) =>
      deletionReceipt(database, operationId),
    );
  }
  setSecureData(
    operationId: string,
    secureData: "deleted" | "failed",
    updatedAt: string,
  ) {
    requireUtc(updatedAt);
    return this.store.write(async (database) => {
      await database.runAsync(
        `UPDATE deletion_tombstones SET secure_data = ? WHERE operation_id = ? AND target_kind = 'full-reset'`,
        [secureData, operationId],
      );
    });
  }
}
