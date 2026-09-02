/**
 * @file job-store.ts
 * @description Focused SQLite job persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { DataGeneration, NormalizedError } from "../../domain/contracts";
import type {
  JobEnqueueInput,
  JobRecord,
  JobRepository as JobRepositoryContract,
} from "../../jobs/contracts";
import { SqliteStore } from "../connection";
import {
  JobRow,
  insertJob,
  json,
  mapJob,
  requireCurrentGeneration,
  requireGeneration,
  requireUtc,
} from "./store-shared";
export class SqliteJobRepository implements JobRepositoryContract {
  constructor(private readonly store: SqliteStore) {}
  enqueue(input: JobEnqueueInput) {
    return this.store.write((database) => insertJob(database, input));
  }
  async get(id: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<JobRow>("SELECT * FROM jobs WHERE id = ?", [id]),
    );
    return row ? mapJob(row) : null;
  }
  async listForCapture(captureId: string) {
    const rows = await this.store.read((database) =>
      database.getAllAsync<JobRow>(
        "SELECT * FROM jobs WHERE capture_id = ? ORDER BY created_at, revision",
        [captureId],
      ),
    );
    return rows.map(mapJob);
  }
  claimNext(now: string, leaseUntil: string) {
    requireUtc(now, leaseUntil);
    return this.store.write(async (database) => {
      const candidate = await database.getFirstAsync<JobRow>(
        `SELECT * FROM jobs
         WHERE status IN ('queued', 'retry-wait') AND run_after <= ? AND attempts < max_attempts
         ORDER BY run_after, created_at, id LIMIT 1`,
        [now],
      );
      if (!candidate) return null;
      const result = await database.runAsync(
        `UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_expires_at = ?, updated_at = ?
         WHERE id = ? AND status IN ('queued', 'retry-wait') AND attempts < max_attempts`,
        [leaseUntil, now, candidate.id],
      );
      if (result.changes === 0) return null;
      return mapJob(
        (await database.getFirstAsync<JobRow>(
          "SELECT * FROM jobs WHERE id = ?",
          [candidate.id],
        ))!,
      );
    });
  }
  succeed(id: string, expectedGeneration: DataGeneration, completedAt: string) {
    requireUtc(completedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'succeeded', lease_expires_at = NULL, last_error_json = NULL,
         completed_at = ?, updated_at = ? WHERE id = ? AND generation = ? AND status = 'running'`,
        [completedAt, completedAt, id, expectedGeneration],
      );
    });
  }
  retry(
    id: string,
    expectedGeneration: DataGeneration,
    runAfter: string,
    error: NormalizedError,
  ) {
    requireUtc(runAfter, error.occurredAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const job = await database.getFirstAsync<JobRow>(
        "SELECT * FROM jobs WHERE id = ?",
        [id],
      );
      if (
        !job ||
        job.generation !== expectedGeneration ||
        job.status === "cancelled" ||
        job.status === "succeeded"
      )
        return;
      const exhausted = job.attempts >= job.max_attempts;
      await database.runAsync(
        `UPDATE jobs SET status = ?, run_after = ?, lease_expires_at = NULL, last_error_json = ?,
         completed_at = ?, updated_at = ? WHERE id = ?`,
        [
          exhausted ? "failed" : "retry-wait",
          runAfter,
          json(error),
          exhausted ? error.occurredAt : null,
          error.occurredAt,
          id,
        ],
      );
    });
  }
  fail(
    id: string,
    expectedGeneration: DataGeneration,
    failedAt: string,
    error: NormalizedError,
  ) {
    requireUtc(failedAt, error.occurredAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'failed', lease_expires_at = NULL, last_error_json = ?,
         completed_at = ?, updated_at = ? WHERE id = ? AND generation = ? AND status != 'cancelled'`,
        [json(error), failedAt, failedAt, id, expectedGeneration],
      );
    });
  }
  cancelForCapture(
    captureId: string,
    expectedGeneration: DataGeneration,
    cancelledAt: string,
  ) {
    requireUtc(cancelledAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
         WHERE capture_id = ? AND generation = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')`,
        [cancelledAt, cancelledAt, captureId, expectedGeneration],
      );
    });
  }
  requeueExpiredLeases(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const exhausted = await database.getAllAsync<{
        id: string;
        capture_id: string;
        generation: number;
        kind: JobRecord["kind"];
      }>(
        `SELECT id, capture_id, generation, kind FROM jobs
         WHERE status = 'running' AND lease_expires_at <= ? AND attempts >= max_attempts`,
        [now],
      );
      const staleError = (kind: JobRecord["kind"]): NormalizedError => ({
        code: "timeout",
        operation:
          kind === "transcribe-capture" ? "transcription" : "report-generation",
        message: "Processing stopped before this job completed.",
        retryable: false,
        occurredAt: now,
        providerId: null,
        statusCode: null,
      });
      await database.runAsync(
        `UPDATE jobs SET
          status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
          run_after = CASE WHEN attempts >= max_attempts THEN run_after ELSE ? END,
          lease_expires_at = NULL,
          last_error_json = CASE
            WHEN attempts >= max_attempts AND kind = 'transcribe-capture' THEN ?
            WHEN attempts >= max_attempts THEN ?
            ELSE last_error_json
          END,
          completed_at = CASE WHEN attempts >= max_attempts THEN ? ELSE NULL END,
          updated_at = ?
         WHERE status = 'running' AND lease_expires_at <= ?`,
        [
          now,
          json(staleError("transcribe-capture")),
          json(staleError("generate-report")),
          now,
          now,
          now,
        ],
      );
      for (const job of exhausted) {
        await database.runAsync(
          `UPDATE captures SET status = 'failed', error_json = ?, updated_at = ? WHERE id = ? AND generation = ?`,
          [json(staleError(job.kind)), now, job.capture_id, job.generation],
        );
      }
      if (!exhausted.length) return [];
      const rows = await database.getAllAsync<JobRow>(
        `SELECT * FROM jobs WHERE id IN (${exhausted.map(() => "?").join(", ")})`,
        exhausted.map((job) => job.id),
      );
      return rows.map(mapJob);
    });
  }
}
