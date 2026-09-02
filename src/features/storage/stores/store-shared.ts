/**
 * @file store-shared.ts
 * @description Shared SQLite row codecs and validation used by focused stores.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { SQLiteDatabase, SQLiteRunResult } from "expo-sqlite";

import type {
  AppPreferencesRecord,
  AudioAsset,
  CaptureRecord,
  CleanupQueueRecord,
  DataGeneration,
  MessageRecord,
  NormalizedError,
  ReportContent,
  ReportField,
  ReportProvenance,
  ReportRecord,
  ReportUpdateProposal,
  SourceRecord,
  TranscriptSnapshot,
} from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import type {
  JobEnqueueInput,
  JobPayload,
  JobRecord,
  ReportJobPayload,
} from "../../jobs/contracts";

export type CaptureRow = {
  id: string;
  generation: number;
  title: string | null;
  summary: string | null;
  kind: string | null;
  status: CaptureRecord["status"];
  transcript_json: string | null;
  audio_json: string | null;
  duration_ms: number;
  starred: number;
  active_report_revision: number | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportRow = {
  capture_id: string;
  generation: number;
  revision: number;
  request_id: string;
  phase: ReportRecord["phase"];
  origin: ReportRecord["origin"];
  supersedes_revision: number | null;
  transcript_revision: number;
  content_json: string;
  provenance_json: string;
  provider_id: string | null;
  model: string | null;
  created_at: string;
};

export type SourceRow = {
  id: string;
  capture_id: string;
  report_revision: number;
  title: string;
  url: string;
  domain: string;
  published_at: string | null;
  accessed_at: string;
};

export type MessageRow = {
  id: string;
  capture_id: string;
  generation: number;
  role: MessageRecord["role"];
  content: string;
  status: MessageRecord["status"];
  client_request_id: string;
  reply_to_message_id: string | null;
  report_revision: number | null;
  last_sequence: number;
  proposal_json: string | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  capture_id: string;
  generation: number;
  kind: JobRecord["kind"];
  revision: number;
  request_id: string;
  status: JobRecord["status"];
  attempts: number;
  max_attempts: number;
  run_after: string;
  lease_expires_at: string | null;
  last_error_json: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CleanupRow = {
  id: string;
  operation_id: string;
  kind: "delete-audio";
  uri: string;
  status: CleanupQueueRecord["status"];
  attempts: number;
  run_after: string;
  last_error_json: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationRow = { generation: number };

export const reportFields = [
  "gist",
  "evidence",
  "risks",
  "nextMove",
  "verdict",
] as const satisfies readonly ReportField[];
export const reportJobReasons = [
  "initial-capture",
  "explicit-regenerate",
  "discussion-update",
] as const;
export function isReportField(value: unknown): value is ReportField {
  return reportFields.some((candidate) => candidate === value);
}
export function isReportJobReason(
  value: unknown,
): value is ReportJobPayload["reason"] {
  return reportJobReasons.some((candidate) => candidate === value);
}

export const defaultPreferences: AppPreferencesRecord = {
  id: "app",
  displayName: "",
  languageTag: "en",
  onboardingComplete: false,
  researchEnabled: false,
  researchConsent: { status: "unknown", policyVersion: null, decidedAt: null },
  notifications: { enabled: false, reportReady: true, processingFailed: true },
  speechProvider: { providerId: "", model: "", endpoint: null },
  aiProvider: { providerId: "", model: "", endpoint: null },
  customSystemPrompt: null,
  updatedAt: "1970-01-01T00:00:00.000Z",
};
export function supportedPreferences(
  preferences: AppPreferencesRecord,
): AppPreferencesRecord {
  return preferences.languageTag === "en"
    ? preferences
    : { ...preferences, languageTag: "en" };
}
export function json(value: unknown) {
  return JSON.stringify(value);
}
export function parse<T>(value: string | null): T | null {
  return value === null ? null : (JSON.parse(value) as T);
}
export function parseJobPayload(value: string): JobPayload {
  const payload = JSON.parse(value) as unknown;
  if (!payload || typeof payload !== "object") {
    throw domainError(
      "storage-failed",
      "database",
      "A persisted job payload is invalid.",
    );
  }
  const record = payload as Record<string, unknown>;
  if (record.kind !== "generate-report") return payload as JobPayload;

  const transcriptRevision = record.transcriptRevision;
  const expectedActiveRevision = record.expectedActiveRevision;
  const researchEnabled = record.researchEnabled;
  const reason = record.reason;
  if (
    typeof transcriptRevision !== "number" ||
    !Number.isInteger(transcriptRevision) ||
    transcriptRevision < 0 ||
    !(
      expectedActiveRevision === undefined ||
      expectedActiveRevision === null ||
      (typeof expectedActiveRevision === "number" &&
        Number.isInteger(expectedActiveRevision) &&
        expectedActiveRevision >= 1)
    ) ||
    typeof researchEnabled !== "boolean" ||
    !isReportJobReason(reason)
  ) {
    throw domainError(
      "storage-failed",
      "database",
      "A persisted report job payload is invalid.",
    );
  }

  const fields = record.explicitlyReplacedUserFields;
  const normalizedFields: ReportField[] =
    fields === undefined
      ? []
      : Array.isArray(fields)
        ? fields.map((field) => {
            if (!isReportField(field)) {
              throw domainError(
                "storage-failed",
                "database",
                "A persisted report job lists an invalid user-owned field.",
              );
            }
            return field;
          })
        : (() => {
            throw domainError(
              "storage-failed",
              "database",
              "A persisted report job lists an invalid user-owned field.",
            );
          })();
  if (new Set(normalizedFields).size !== normalizedFields.length) {
    throw domainError(
      "storage-failed",
      "database",
      "A persisted report job lists a user-owned field more than once.",
    );
  }
  const reportPayload: ReportJobPayload = {
    kind: "generate-report",
    transcriptRevision,
    // Legacy jobs lacked this barrier; null preserves initial jobs and conflicts if a report is active.
    expectedActiveRevision:
      expectedActiveRevision === undefined ? null : expectedActiveRevision,
    researchEnabled,
    reason,
    explicitlyReplacedUserFields: normalizedFields,
  };
  return reportPayload;
}
export function requireReportFields(
  fields: unknown,
): asserts fields is readonly ReportField[] {
  if (
    !Array.isArray(fields) ||
    fields.some(
      (field) =>
        typeof field !== "string" ||
        !reportFields.includes(field as ReportField),
    ) ||
    new Set(fields).size !== fields.length
  ) {
    throw domainError(
      "conflict",
      "database",
      "Report jobs may replace only known user-owned fields.",
    );
  }
}
export function nowIso() {
  return new Date().toISOString();
}
export function requireGeneration(generation: DataGeneration) {
  if (!Number.isInteger(generation) || generation < 0) {
    throw domainError(
      "conflict",
      "database",
      "The data generation is invalid.",
    );
  }
}
export async function currentGeneration(
  database: SQLiteDatabase,
): Promise<DataGeneration> {
  const row = await database.getFirstAsync<GenerationRow>(
    "SELECT generation FROM data_generation WHERE id = 1",
  );
  if (!row)
    throw domainError(
      "storage-failed",
      "database",
      "The data generation could not be read.",
      true,
    );
  requireGeneration(row.generation);
  return row.generation;
}
export async function requireCurrentGeneration(
  database: SQLiteDatabase,
  expected: DataGeneration,
) {
  requireGeneration(expected);
  const actual = await currentGeneration(database);
  if (actual !== expected) {
    throw domainError(
      "cancelled",
      "database",
      "The operation belongs to data that was deleted.",
    );
  }
}
export function requireUtc(...values: readonly string[]) {
  for (const value of values) {
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      Number.isNaN(Date.parse(value)) ||
      new Date(value).toISOString() !== value
    ) {
      throw domainError(
        "conflict",
        "database",
        "Timestamps must be UTC ISO-8601 values.",
      );
    }
  }
}
export function requireHttps(source: Pick<SourceRecord, "url" | "domain">) {
  let parsed: URL;
  try {
    parsed = new URL(source.url);
  } catch {
    throw domainError(
      "invalid-url",
      "database",
      "A research source URL is invalid.",
    );
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const domain = source.domain.toLowerCase().replace(/^www\./, "");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !hostname ||
    hostname !== domain
  ) {
    throw domainError(
      "invalid-url",
      "database",
      "Research sources must use credential-free HTTPS URLs.",
    );
  }
}
export function requireSafeEndpoint(value: string | null) {
  if (!value) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw domainError(
      "invalid-url",
      "database",
      "The provider endpoint is invalid.",
    );
  }
  const hasCredentialParameter = [...parsed.searchParams.keys()].some((key) =>
    /(?:^|[-_])(api[-_]?key|key|token|auth(?:orization)?|bearer|secret|password|credential|signature|sig|subscription[-_]?key)(?:$|[-_])/i.test(
      key,
    ),
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    hasCredentialParameter
  ) {
    throw domainError(
      "invalid-url",
      "database",
      "Provider endpoints must be credential-free HTTPS URLs.",
    );
  }
}
export function requireAudio(audio: AudioAsset) {
  if (
    !audio.uri ||
    !audio.container ||
    !audio.mimeType ||
    audio.sampleRateHz <= 0 ||
    audio.channelCount <= 0 ||
    audio.bitRateBps <= 0 ||
    audio.durationMs < 0 ||
    audio.byteLength < 0 ||
    ![
      audio.sampleRateHz,
      audio.channelCount,
      audio.bitRateBps,
      audio.durationMs,
      audio.byteLength,
    ].every(Number.isFinite)
  ) {
    throw domainError(
      "conflict",
      "database",
      "The recording metadata is incomplete.",
    );
  }
}
export function mapCapture(row: CaptureRow): CaptureRecord {
  return {
    id: row.id,
    generation: row.generation,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    status: row.status,
    transcript: parse<TranscriptSnapshot>(row.transcript_json),
    audio: parse<AudioAsset>(row.audio_json),
    durationMs: row.duration_ms,
    starred: row.starred === 1,
    activeReportRevision: row.active_report_revision,
    error: parse<NormalizedError>(row.error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function mapReport(row: ReportRow): ReportRecord {
  return {
    captureId: row.capture_id,
    generation: row.generation,
    revision: row.revision,
    requestId: row.request_id,
    phase: row.phase,
    origin: row.origin,
    supersedesRevision: row.supersedes_revision,
    transcriptRevision: row.transcript_revision,
    content: JSON.parse(row.content_json) as ReportContent,
    provenance: JSON.parse(row.provenance_json) as ReportProvenance,
    providerId: row.provider_id,
    model: row.model,
    createdAt: row.created_at,
  };
}
export function mapSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    reportRevision: row.report_revision,
    title: row.title,
    url: row.url,
    domain: row.domain,
    publishedAt: row.published_at,
    accessedAt: row.accessed_at,
  };
}
export function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    generation: row.generation,
    role: row.role,
    content: row.content,
    status: row.status,
    clientRequestId: row.client_request_id,
    replyToMessageId: row.reply_to_message_id,
    reportRevision: row.report_revision,
    lastSequence: row.last_sequence,
    reportUpdateProposal: parse<ReportUpdateProposal>(row.proposal_json),
    error: parse<NormalizedError>(row.error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    generation: row.generation,
    kind: row.kind,
    revision: row.revision,
    requestId: row.request_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    leaseExpiresAt: row.lease_expires_at,
    lastError: parse<NormalizedError>(row.last_error_json),
    payload: parseJobPayload(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  } as JobRecord;
}
export function mapCleanup(row: CleanupRow): CleanupQueueRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    kind: row.kind,
    uri: row.uri,
    status: row.status,
    attempts: row.attempts,
    runAfter: row.run_after,
    lastError: parse(row.last_error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function transcriptColumns(transcript: TranscriptSnapshot | null) {
  return transcript
    ? ([
        json(transcript),
        transcript.phase,
        transcript.revision,
        transcript.requestId,
      ] as const)
    : ([null, null, null, null] as const);
}
export async function getCapture(database: SQLiteDatabase, id: string) {
  const row = await database.getFirstAsync<CaptureRow>(
    "SELECT * FROM captures WHERE id = ?",
    [id],
  );
  return row ? mapCapture(row) : null;
}
export function jobId(input: JobEnqueueInput) {
  return `job:${json([input.captureId, input.payload.kind, input.revision])}`;
}
export async function insertJob(
  database: SQLiteDatabase,
  input: JobEnqueueInput,
): Promise<JobRecord> {
  requireUtc(input.runAfter);
  requireGeneration(input.generation);
  await requireCurrentGeneration(database, input.generation);
  if (
    !Number.isInteger(input.revision) ||
    !Number.isInteger(input.maxAttempts) ||
    input.revision < 1 ||
    input.maxAttempts < 1
  ) {
    throw domainError(
      "conflict",
      "database",
      "Job revisions and attempt limits must be positive.",
    );
  }
  if (input.payload.kind === "transcribe-capture")
    requireAudio(input.payload.audio);
  else requireReportFields(input.payload.explicitlyReplacedUserFields);
  const existing = await database.getFirstAsync<JobRow>(
    "SELECT * FROM jobs WHERE capture_id = ? AND kind = ? AND revision = ?",
    [input.captureId, input.payload.kind, input.revision],
  );
  if (existing) {
    if (
      existing.generation !== input.generation ||
      existing.request_id !== input.requestId ||
      json(parseJobPayload(existing.payload_json)) !== json(input.payload)
    ) {
      throw domainError(
        "conflict",
        "database",
        "This job revision already belongs to another request.",
      );
    }
    return mapJob(existing);
  }

  const capture = await getCapture(database, input.captureId);
  if (!capture)
    throw domainError("not-found", "database", "The capture was deleted.");
  if (capture.generation !== input.generation) {
    throw domainError(
      "cancelled",
      "database",
      "The job belongs to data that was deleted.",
    );
  }
  const createdAt = nowIso();
  const inputRevision =
    input.payload.kind === "transcribe-capture"
      ? input.payload.expectedTranscriptRevision
      : input.payload.transcriptRevision;
  await database.runAsync(
    `INSERT INTO jobs (
      id, capture_id, generation, kind, revision, request_id, status, attempts, max_attempts, run_after,
      lease_expires_at, last_error_json, payload_json, input_revision, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`,
    [
      jobId(input),
      input.captureId,
      input.generation,
      input.payload.kind,
      input.revision,
      input.requestId,
      input.maxAttempts,
      input.runAfter,
      json(input.payload),
      inputRevision,
      createdAt,
      createdAt,
    ],
  );
  const saved = await database.getFirstAsync<JobRow>(
    "SELECT * FROM jobs WHERE id = ?",
    [jobId(input)],
  );
  if (!saved)
    throw domainError(
      "storage-failed",
      "database",
      "The job could not be saved.",
      true,
    );
  return mapJob(saved);
}

/** Requires a mutation to affect a live row or reports a stable not-found error. */
export function requireChanged(result: SQLiteRunResult, message: string): void {
  if (result.changes === 0) throw domainError("not-found", "database", message);
}
