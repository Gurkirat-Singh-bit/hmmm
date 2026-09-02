/**
 * @file capture-store.ts
 * @description Focused SQLite capture persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AudioAsset,
  CaptureRecord,
  DataGeneration,
  NormalizedError,
  RecordingDraftRecord,
  TranscriptSnapshot,
} from "../../domain/contracts";
import { CAPTURE_TITLE_MAX_CHARACTERS } from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import { SqliteStore } from "../connection";
import type {
  CaptureQuery,
  CaptureRepository,
  CommitRecordingInput,
  RecordingDraftRepository,
} from "../contracts";
import {
  CaptureRow,
  getCapture,
  insertJob,
  json,
  mapCapture,
  parse,
  requireAudio,
  requireChanged,
  requireCurrentGeneration,
  requireGeneration,
  requireUtc,
  transcriptColumns,
} from "./store-shared";
export class SqliteRecordingDraftRepository implements RecordingDraftRepository {
  constructor(private readonly store: SqliteStore) {}
  async get(id: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<{
        id: string;
        capture_id: string;
        recovery_id: string;
        generation: number;
        status: RecordingDraftRecord["status"];
        audio_json: string | null;
        transcript_json: string | null;
        duration_ms: number;
        error_json: string | null;
        created_at: string;
        updated_at: string;
      }>("SELECT * FROM recording_drafts WHERE id = ?", [id]),
    );
    return row
      ? {
          id: row.id,
          captureId: row.capture_id,
          generation: row.generation,
          recoveryId: row.recovery_id,
          status: row.status,
          audio: parse<AudioAsset>(row.audio_json),
          transcript: parse<TranscriptSnapshot>(row.transcript_json),
          durationMs: row.duration_ms,
          error: parse<NormalizedError>(row.error_json),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }
  async list() {
    const rows = await this.store.read((database) =>
      database.getAllAsync<{
        id: string;
        capture_id: string;
        recovery_id: string;
        generation: number;
        status: RecordingDraftRecord["status"];
        audio_json: string | null;
        transcript_json: string | null;
        duration_ms: number;
        error_json: string | null;
        created_at: string;
        updated_at: string;
      }>("SELECT * FROM recording_drafts ORDER BY created_at, id"),
    );
    return rows.map((row) => ({
      id: row.id,
      captureId: row.capture_id,
      generation: row.generation,
      recoveryId: row.recovery_id,
      status: row.status,
      audio: parse<AudioAsset>(row.audio_json),
      transcript: parse<TranscriptSnapshot>(row.transcript_json),
      durationMs: row.duration_ms,
      error: parse<NormalizedError>(row.error_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  save(draft: RecordingDraftRecord) {
    requireUtc(draft.createdAt, draft.updatedAt);
    requireGeneration(draft.generation);
    if (draft.audio) requireAudio(draft.audio);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, draft.generation);
      const existing = await database.getFirstAsync<{
        capture_id: string;
        recovery_id: string;
        generation: number;
      }>(
        "SELECT capture_id, recovery_id, generation FROM recording_drafts WHERE id = ?",
        [draft.id],
      );
      if (
        existing &&
        (existing.capture_id !== draft.captureId ||
          existing.recovery_id !== draft.recoveryId ||
          existing.generation !== draft.generation)
      ) {
        throw domainError(
          "conflict",
          "database",
          "A recording draft cannot change its recovery identity.",
        );
      }
      await database.runAsync(
        `INSERT INTO recording_drafts (
          id, capture_id, recovery_id, generation, status, audio_json, transcript_json, duration_ms, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          audio_json = excluded.audio_json, transcript_json = excluded.transcript_json,
          duration_ms = excluded.duration_ms, error_json = excluded.error_json, updated_at = excluded.updated_at`,
        [
          draft.id,
          draft.captureId,
          draft.recoveryId,
          draft.generation,
          draft.status,
          draft.audio ? json(draft.audio) : null,
          draft.transcript ? json(draft.transcript) : null,
          draft.durationMs,
          draft.error ? json(draft.error) : null,
          draft.createdAt,
          draft.updatedAt,
        ],
      );
    });
  }
  delete(id: string, expectedGeneration: DataGeneration) {
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        "DELETE FROM recording_drafts WHERE id = ? AND generation = ?",
        [id, expectedGeneration],
      );
    });
  }
}
export class SqliteCaptureRepository implements CaptureRepository {
  constructor(private readonly store: SqliteStore) {}
  get(id: string) {
    return this.store.read((database) => getCapture(database, id));
  }
  async list(query: CaptureQuery) {
    const clauses: string[] = [];
    const parameters: (string | number)[] = [];
    const search = query.search.trim().toLowerCase();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      clauses.push(`(
        lower(COALESCE(title, '')) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(summary, '')) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(transcript_text, '')) LIKE ? ESCAPE '\\'
      )`);
      parameters.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }
    if (query.starred !== null) {
      clauses.push("starred = ?");
      parameters.push(query.starred ? 1 : 0);
    }
    if (query.statuses.length) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      parameters.push(...query.statuses);
    }
    const orders: Record<CaptureQuery["sort"], string> = {
      newest: "created_at DESC, id DESC",
      oldest: "created_at ASC, id ASC",
      "title-asc": "lower(COALESCE(title, '')) ASC, created_at DESC",
      "title-desc": "lower(COALESCE(title, '')) DESC, created_at DESC",
    };
    parameters.push(query.limit ?? -1, query.offset);
    const rows = await this.store.read((database) =>
      database.getAllAsync<CaptureRow>(
        `SELECT * FROM captures ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
       ORDER BY ${orders[query.sort]} LIMIT ? OFFSET ?`,
        parameters,
      ),
    );
    return rows.map(mapCapture);
  }
  async listRecent(limit: number) {
    const rows = await this.store.read((database) =>
      database.getAllAsync<CaptureRow>(
        "SELECT * FROM captures ORDER BY created_at DESC, id DESC LIMIT ?",
        [Math.max(0, limit)],
      ),
    );
    return rows.map(mapCapture);
  }
  commitRecording(input: CommitRecordingInput) {
    requireUtc(input.capture.createdAt, input.capture.updatedAt);
    requireGeneration(input.capture.generation);
    if (!input.capture.audio)
      throw domainError(
        "conflict",
        "database",
        "A saved capture requires source audio.",
      );
    if (input.capture.activeReportRevision !== null) {
      throw domainError(
        "conflict",
        "database",
        "A new capture cannot already have an active report.",
      );
    }
    requireAudio(input.capture.audio);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.capture.generation);
      const existing = await getCapture(database, input.capture.id);
      if (existing) return existing;
      const draft = await database.getFirstAsync<{
        capture_id: string;
        generation: number;
      }>("SELECT capture_id, generation FROM recording_drafts WHERE id = ?", [
        input.draftId,
      ]);
      if (!draft || draft.capture_id !== input.capture.id) {
        throw domainError(
          "conflict",
          "database",
          "The recording draft no longer matches this capture.",
        );
      }
      if (draft.generation !== input.capture.generation) {
        throw domainError(
          "cancelled",
          "database",
          "The recording belongs to data that was deleted.",
        );
      }
      const [
        transcriptJson,
        transcriptPhase,
        transcriptRevision,
        transcriptRequestId,
      ] = transcriptColumns(input.capture.transcript);
      await database.runAsync(
        `INSERT INTO captures (
          id, generation, title, summary, kind, status, transcript_json, transcript_text, transcript_phase, transcript_revision,
          transcript_request_id, audio_json, duration_ms, starred, active_report_revision,
          error_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.capture.id,
          input.capture.generation,
          input.capture.title,
          input.capture.summary,
          input.capture.kind,
          input.capture.status,
          transcriptJson,
          input.capture.transcript?.text ?? null,
          transcriptPhase,
          transcriptRevision,
          transcriptRequestId,
          input.capture.audio ? json(input.capture.audio) : null,
          input.capture.durationMs,
          input.capture.starred ? 1 : 0,
          input.capture.activeReportRevision,
          input.capture.error ? json(input.capture.error) : null,
          input.capture.createdAt,
          input.capture.updatedAt,
        ],
      );
      for (const job of input.jobs) {
        if (job.captureId !== input.capture.id) {
          throw domainError(
            "conflict",
            "database",
            "A capture cannot enqueue work for another capture.",
          );
        }
        await insertJob(database, job);
      }
      await database.runAsync("DELETE FROM recording_drafts WHERE id = ?", [
        input.draftId,
      ]);
      return (await getCapture(database, input.capture.id))!;
    });
  }
  setStarred(
    id: string,
    starred: boolean,
    updatedAt: string,
    expectedGeneration: DataGeneration,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        "UPDATE captures SET starred = ?, updated_at = ? WHERE id = ? AND generation = ?",
        [starred ? 1 : 0, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, "The capture was not found.");
    });
  }
  setTitle(
    id: string,
    title: string,
    updatedAt: string,
    expectedGeneration: DataGeneration,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    const normalized = title.trim();
    if (!normalized || normalized.length > CAPTURE_TITLE_MAX_CHARACTERS) {
      throw domainError(
        "conflict",
        "database",
        `Use a title between 1 and ${CAPTURE_TITLE_MAX_CHARACTERS} characters.`,
      );
    }
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        "UPDATE captures SET title = ?, updated_at = ? WHERE id = ? AND generation = ?",
        [normalized, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, "The capture was not found.");
    });
  }
  setProcessingState(
    id: string,
    status: CaptureRecord["status"],
    error: NormalizedError | null,
    updatedAt: string,
    expectedGeneration: DataGeneration,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        "UPDATE captures SET status = ?, error_json = ?, updated_at = ? WHERE id = ? AND generation = ?",
        [status, error ? json(error) : null, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, "The capture was not found.");
    });
  }
  queueProcessing(input: Parameters<CaptureRepository["queueProcessing"]>[0]) {
    requireUtc(input.updatedAt, input.job.runAfter);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.id);
      if (!capture)
        throw domainError(
          "not-found",
          "database",
          "The capture was not found.",
        );
      if (capture.generation !== input.expectedGeneration) {
        throw domainError(
          "cancelled",
          "database",
          "The capture belongs to data that was deleted.",
        );
      }
      if (
        input.job.captureId !== input.id ||
        input.job.generation !== input.expectedGeneration
      ) {
        throw domainError(
          "conflict",
          "database",
          "The processing job does not match the capture.",
        );
      }
      await database.runAsync(
        "UPDATE captures SET status = ?, error_json = ?, updated_at = ? WHERE id = ? AND generation = ?",
        [
          input.status,
          input.error ? json(input.error) : null,
          input.updatedAt,
          input.id,
          input.expectedGeneration,
        ],
      );
      return insertJob(database, input.job);
    });
  }
  replaceTranscript(
    id: string,
    expectedRevision: number,
    transcript: TranscriptSnapshot,
    updatedAt: string,
    expectedGeneration: DataGeneration,
  ) {
    requireUtc(transcript.createdAt, updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const capture = await getCapture(database, id);
      if (!capture)
        throw domainError("not-found", "database", "The capture was deleted.");
      if (capture.generation !== expectedGeneration)
        throw domainError("cancelled", "database", "The capture was deleted.");
      if (capture.transcript?.phase === "final") {
        if (capture.transcript.requestId === transcript.requestId) return;
        throw domainError(
          "conflict",
          "database",
          "The final transcript cannot be overwritten.",
        );
      }
      if (
        (capture.transcript?.revision ?? 0) !== expectedRevision ||
        transcript.revision !== expectedRevision + 1
      ) {
        throw domainError(
          "conflict",
          "database",
          "The transcript changed before this update was saved.",
        );
      }
      await database.runAsync(
        `UPDATE captures SET transcript_json = ?, transcript_text = ?, transcript_phase = ?, transcript_revision = ?,
         transcript_request_id = ?, updated_at = ? WHERE id = ? AND generation = ?`,
        [
          json(transcript),
          transcript.text,
          transcript.phase,
          transcript.revision,
          transcript.requestId,
          updatedAt,
          id,
          expectedGeneration,
        ],
      );
    });
  }
  completeTranscription(
    input: Parameters<CaptureRepository["completeTranscription"]>[0],
  ) {
    requireUtc(
      input.transcript.createdAt,
      ...(input.reportJob ? [input.reportJob.runAfter] : []),
      input.updatedAt,
    );
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.id);
      if (!capture)
        throw domainError("not-found", "database", "The capture was deleted.");
      if (capture.generation !== input.expectedGeneration)
        throw domainError("cancelled", "database", "The capture was deleted.");
      if (
        input.reportJob &&
        (input.reportJob.captureId !== input.id ||
          input.reportJob.payload.kind !== "generate-report" ||
          input.reportJob.payload.transcriptRevision !==
            input.transcript.revision)
      ) {
        throw domainError(
          "conflict",
          "database",
          "The report job does not match the completed transcript.",
        );
      }
      if (capture.transcript?.phase === "final") {
        if (capture.transcript.requestId !== input.transcript.requestId) {
          throw domainError(
            "conflict",
            "database",
            "The final transcript cannot be overwritten.",
          );
        }
        if (input.reportJob) await insertJob(database, input.reportJob);
        return capture;
      }
      if (
        (capture.transcript?.revision ?? 0) !== input.expectedRevision ||
        input.transcript.revision !== input.expectedRevision + 1
      ) {
        throw domainError(
          "conflict",
          "database",
          "The transcript changed before transcription completed.",
        );
      }
      if (!input.reportJob) {
        const provisional = await database.getFirstAsync<{
          capture_id: string;
        }>(
          `SELECT capture_id FROM reports
           WHERE capture_id = ? AND phase = 'provisional' AND transcript_revision = ?`,
          [input.id, input.expectedRevision],
        );
        if (!provisional) {
          throw domainError(
            "conflict",
            "database",
            "A final transcript requires a report job unless it supersedes a provisional report.",
          );
        }
      }
      await database.runAsync(
        `UPDATE captures SET transcript_json = ?, transcript_text = ?, transcript_phase = 'final', transcript_revision = ?,
         transcript_request_id = ?, status = 'queued', error_json = NULL, updated_at = ? WHERE id = ?`,
        [
          json(input.transcript),
          input.transcript.text,
          input.transcript.revision,
          input.transcript.requestId,
          input.updatedAt,
          input.id,
        ],
      );
      if (input.reportJob) await insertJob(database, input.reportJob);
      return (await getCapture(database, input.id))!;
    });
  }
}
