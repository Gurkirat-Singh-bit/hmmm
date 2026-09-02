/**
 * @file contracts.ts
 * @description Durable job records and repository contracts for transcription and report work.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AudioAsset,
  CaptureId,
  DataGeneration,
  IsoTimestamp,
  NormalizedError,
  ReportField,
  ReportRevision,
} from "../domain/contracts";

export type JobKind = "transcribe-capture" | "generate-report";
export type JobStatus =
  "queued" | "running" | "retry-wait" | "succeeded" | "failed" | "cancelled";

export type TranscriptionJobPayload = Readonly<{
  kind: "transcribe-capture";
  audio: AudioAsset;
  expectedTranscriptRevision: number;
}>;

export type ReportJobPayload = Readonly<{
  kind: "generate-report";
  transcriptRevision: number;
  /** Active report revision observed when this job was confirmed; null means no active report. */
  expectedActiveRevision: ReportRevision | null;
  researchEnabled: boolean;
  reason: "initial-capture" | "explicit-regenerate" | "discussion-update";
  explicitlyReplacedUserFields: readonly ReportField[];
}>;

export type JobPayload = TranscriptionJobPayload | ReportJobPayload;

type JobRecordBase = Readonly<{
  id: string;
  captureId: CaptureId;
  /** Global data generation that created this job. */
  generation: DataGeneration;
  /** Unique with captureId and kind; retries retain this revision. */
  revision: number;
  /** Stable provider idempotency linkage retained across retries. */
  requestId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: IsoTimestamp;
  leaseExpiresAt: IsoTimestamp | null;
  lastError: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  completedAt: IsoTimestamp | null;
}>;

export type JobRecord = {
  [Kind in JobKind]: JobRecordBase &
    Readonly<{
      kind: Kind;
      payload: Extract<JobPayload, { kind: Kind }>;
    }>;
}[JobKind];

export type JobEnqueueInput = Readonly<{
  captureId: CaptureId;
  generation: DataGeneration;
  revision: number;
  requestId: string;
  payload: JobPayload;
  runAfter: IsoTimestamp;
  maxAttempts: number;
}>;

export interface JobRepository {
  /** Returns the existing row for the same (captureId, kind, revision). */
  enqueue(input: JobEnqueueInput): Promise<JobRecord>;
  get(id: string): Promise<JobRecord | null>;
  listForCapture(captureId: CaptureId): Promise<readonly JobRecord[]>;
  /** Atomically leases one runnable job and increments attempts. */
  claimNext(
    now: IsoTimestamp,
    leaseUntil: IsoTimestamp,
  ): Promise<JobRecord | null>;
  succeed(
    id: string,
    expectedGeneration: DataGeneration,
    completedAt: IsoTimestamp,
  ): Promise<void>;
  retry(
    id: string,
    expectedGeneration: DataGeneration,
    runAfter: IsoTimestamp,
    error: NormalizedError,
  ): Promise<void>;
  fail(
    id: string,
    expectedGeneration: DataGeneration,
    failedAt: IsoTimestamp,
    error: NormalizedError,
  ): Promise<void>;
  cancelForCapture(
    captureId: CaptureId,
    expectedGeneration: DataGeneration,
    cancelledAt: IsoTimestamp,
  ): Promise<void>;
  /** Fails exhausted leases and requeues the rest without incrementing attempts again. */
  requeueExpiredLeases(now: IsoTimestamp): Promise<readonly JobRecord[]>;
}

export interface JobHandler<Payload extends JobPayload = JobPayload> {
  readonly kind: Payload["kind"];
  run(job: JobRecord & Readonly<{ payload: Payload }>): Promise<void>;
}

export interface JobRunnerPort {
  start(): void;
  wake(): void;
  stop(): Promise<void>;
}
