/**
 * @file contracts.ts
 * @description Persisted domain records and platform ports, excluding provider wire shapes and secrets.
 * @author Gurkirat Singh
 * @license MIT
 */

export type IsoTimestamp = string;
export type DataGeneration = number;
export type CaptureId = string;
export type DraftId = string;
export type MessageId = string;
export type ReportRevision = number;

export const CAPTURE_TITLE_MAX_CHARACTERS = 120;

export type AppOperation =
  | "recording"
  | "transcription"
  | "report-generation"
  | "research"
  | "discussion"
  | "database"
  | "file-cleanup"
  | "export"
  | "notification"
  | "provider-configuration";

export type NormalizedErrorCode =
  | "permission-denied"
  | "configuration-missing"
  | "unsupported"
  | "offline"
  | "authentication-failed"
  | "rate-limited"
  | "timeout"
  | "provider-unavailable"
  | "provider-rejected"
  | "invalid-provider-output"
  | "invalid-url"
  | "recording-interrupted"
  | "storage-failed"
  | "not-found"
  | "conflict"
  | "cancelled"
  | "unknown";

/** Safe to persist and display. It must never contain keys, headers, or raw provider bodies. */
export type NormalizedError = Readonly<{
  code: NormalizedErrorCode;
  operation: AppOperation;
  message: string;
  retryable: boolean;
  occurredAt: IsoTimestamp;
  providerId: string | null;
  statusCode: number | null;
}>;

export type TranscriptPhase = "provisional" | "final";

export type TranscriptSegment = Readonly<{
  startMs: number;
  endMs: number;
  text: string;
  confidence: number | null;
}>;

/**
 * A provisional snapshot may be replaced using optimistic revision checks.
 * A final snapshot is never silently replaced.
 */
export type TranscriptSnapshot = Readonly<{
  /** Stable across retries that produce this snapshot. */
  requestId: string;
  phase: TranscriptPhase;
  revision: number;
  text: string;
  languageTag: string | null;
  segments: readonly TranscriptSegment[];
  providerId: string | null;
  createdAt: IsoTimestamp;
}>;

export type AudioAsset = Readonly<{
  uri: string;
  container: string;
  mimeType: string;
  sampleRateHz: number;
  channelCount: number;
  bitRateBps: number;
  durationMs: number;
  byteLength: number;
}>;

export type RecordingDraftStatus =
  "recording" | "paused" | "finalizing" | "failed";

export type RecordingDraftRecord = Readonly<{
  id: DraftId;
  captureId: CaptureId;
  /** Generation captured when recording began; stale drafts cannot be committed after a reset. */
  generation: DataGeneration;
  /** Stable identity used to resume/finalize this draft after process restart. */
  recoveryId: string;
  status: RecordingDraftStatus;
  audio: AudioAsset | null;
  transcript: TranscriptSnapshot | null;
  durationMs: number;
  error: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}>;

export type CaptureStatus =
  "queued" | "transcribing" | "naming" | "researching" | "ready" | "failed";

export type CaptureRecord = Readonly<{
  id: CaptureId;
  /** Global data generation that created this capture. */
  generation: DataGeneration;
  title: string | null;
  summary: string | null;
  kind: string | null;
  status: CaptureStatus;
  transcript: TranscriptSnapshot | null;
  audio: AudioAsset | null;
  durationMs: number;
  starred: boolean;
  activeReportRevision: ReportRevision | null;
  error: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}>;

export type EvidenceItem = Readonly<{
  id: string;
  text: string;
  sourceIds: readonly string[];
}>;

export type ReportContent = Readonly<{
  gist: string;
  evidence: readonly EvidenceItem[];
  risks: readonly string[];
  nextMove: string;
  verdict: string | null;
}>;

export type ReportPhase = "provisional" | "final";
export type ReportOrigin = "ai-generated" | "user-edited" | "discussion-update";
export type ReportField =
  "gist" | "evidence" | "risks" | "nextMove" | "verdict";
export type ReportFieldProvenance = Readonly<{
  owner: "provider" | "user";
  origin: ReportOrigin;
  sourceRevision: ReportRevision | null;
  changedAt: IsoTimestamp;
}>;
export type ReportProvenance = Readonly<
  Record<ReportField, ReportFieldProvenance>
>;

/** Every persisted report row is an immutable snapshot in an append-only history. */
export type ReportRecord = Readonly<{
  captureId: CaptureId;
  generation: DataGeneration;
  /** Stable across retries that append this revision. */
  requestId: string;
  revision: ReportRevision;
  phase: ReportPhase;
  origin: ReportOrigin;
  supersedesRevision: ReportRevision | null;
  transcriptRevision: number;
  content: ReportContent;
  provenance: ReportProvenance;
  providerId: string | null;
  model: string | null;
  createdAt: IsoTimestamp;
}>;

/** A source belongs to exactly one immutable report revision. */
export type SourceRecord = Readonly<{
  id: string;
  captureId: CaptureId;
  reportRevision: ReportRevision;
  title: string;
  url: string;
  domain: string;
  publishedAt: IsoTimestamp | null;
  accessedAt: IsoTimestamp;
}>;

/** A suggestion is inert until a separate, explicit appendRevision call accepts it. */
export type ReportUpdateProposal = Readonly<{
  id: string;
  captureId: CaptureId;
  baseRevision: ReportRevision;
  content: ReportContent;
  reason: string;
}>;

export type MessageRole = "user" | "assistant";
export type MessageStatus =
  "queued" | "streaming" | "complete" | "interrupted" | "failed";

export type MessageRecord = Readonly<{
  id: MessageId;
  captureId: CaptureId;
  generation: DataGeneration;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  clientRequestId: string;
  replyToMessageId: MessageId | null;
  reportRevision: ReportRevision | null;
  lastSequence: number;
  reportUpdateProposal: ReportUpdateProposal | null;
  error: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}>;

/** One locally persisted composer draft per capture. */
export type DiscussionDraftRecord = Readonly<{
  captureId: CaptureId;
  generation: DataGeneration;
  content: string;
  updatedAt: IsoTimestamp;
}>;

export type ProviderSelection = Readonly<{
  providerId: string;
  model: string;
  /** Validated HTTPS URL without user-info or credential query parameters. */
  endpoint: string | null;
}>;

export type NotificationPreferences = Readonly<{
  enabled: boolean;
  reportReady: boolean;
  processingFailed: boolean;
}>;

export type ResearchConsent = Readonly<{
  status: "unknown" | "granted" | "denied";
  policyVersion: string | null;
  decidedAt: IsoTimestamp | null;
}>;

/** SQLite-safe preferences. Provider credentials are deliberately absent. */
export type AppPreferencesRecord = Readonly<{
  id: "app";
  displayName: string;
  languageTag: string;
  onboardingComplete: boolean;
  researchEnabled: boolean;
  researchConsent: ResearchConsent;
  notifications: NotificationPreferences;
  speechProvider: ProviderSelection;
  aiProvider: ProviderSelection;
  customSystemPrompt: string | null;
  updatedAt: IsoTimestamp;
}>;

export type CredentialKind = "speech" | "ai";
export type CredentialVersion = string;

export type ActiveCredential = Readonly<{
  kind: CredentialKind;
  version: CredentialVersion;
  secret: string;
}>;

/** The only persistence boundary that accepts provider credentials. */
export interface SecretStorePort {
  readActive(kind: CredentialKind): Promise<ActiveCredential | null>;
  /** Writes the versioned secret before switching its active-version pointer. */
  activate(input: ActiveCredential): Promise<void>;
  deleteVersion(
    kind: CredentialKind,
    version: CredentialVersion,
  ): Promise<void>;
  clear(): Promise<void>;
}

export type RecordingPermission = "undetermined" | "denied" | "granted";
export type RecordingSessionState =
  "starting" | "recording" | "paused" | "stopping" | "stopped" | "failed";

export type RecordingEvent =
  | Readonly<{ type: "state"; state: RecordingSessionState }>
  | Readonly<{ type: "duration"; durationMs: number }>
  | Readonly<{
      type: "audio-chunk";
      data: Uint8Array;
      sequence: number;
      mimeType: string;
    }>
  | Readonly<{ type: "interrupted"; error: NormalizedError }>;

export interface RecordingSessionPort {
  readonly id: DraftId;
  readonly supportsAudioChunks?: boolean;
  getState(): RecordingSessionState;
  subscribe(listener: (event: RecordingEvent) => void): () => void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  finish(): Promise<AudioAsset>;
  cancel(): Promise<void>;
}

export interface RecordingPort {
  getPermission(): Promise<RecordingPermission>;
  requestPermission(): Promise<RecordingPermission>;
  start(
    input: Readonly<{
      draftId: DraftId;
      captureId: CaptureId;
      recoveryId: string;
    }>,
  ): Promise<RecordingSessionPort>;
}

export interface AudioFilePort {
  exists(uri: string): Promise<boolean>;
  delete(uri: string): Promise<void>;
  /** Returns only audio files discovered under app-owned storage. */
  listAppOwnedAudioUris(): Promise<readonly string[]>;
}

export type PlaybackState =
  "idle" | "loading" | "playing" | "paused" | "ended" | "failed";
export type PlaybackEvent =
  | Readonly<{ type: "state"; state: PlaybackState }>
  | Readonly<{ type: "position"; positionMs: number; durationMs: number }>
  | Readonly<{ type: "error"; error: NormalizedError }>;

export interface PlaybackSessionPort {
  subscribe(listener: (event: PlaybackEvent) => void): () => void;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

export interface PlaybackPort {
  open(audio: AudioAsset): Promise<PlaybackSessionPort>;
}

export type ExportedCapture = Omit<CaptureRecord, "audio" | "generation"> &
  Readonly<{ hasSourceAudio: boolean }>;
export type ExportedPreferences = Readonly<{
  displayName: string;
  languageTag: string;
  researchEnabled: boolean;
  researchConsent: ResearchConsent;
  notifications: NotificationPreferences;
  speechProvider: ProviderSelection;
  aiProvider: ProviderSelection;
  customSystemPrompt: string | null;
}>;
export type ExportedJobHistory = Readonly<{
  id: string;
  captureId: CaptureId;
  kind: "transcribe-capture" | "generate-report";
  revision: number;
  requestId: string;
  status:
    "queued" | "running" | "retry-wait" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  lastError: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  completedAt: IsoTimestamp | null;
}>;

export type ExportCapture = Readonly<{
  capture: ExportedCapture;
  reports: readonly ReportRecord[];
  sources: readonly SourceRecord[];
  messages: readonly MessageRecord[];
}>;

/** Dedicated safe DTOs exclude credentials, audio paths/bytes, temp drafts, cleanup, and tombstones. */
export type NonSecretExportBundle = Readonly<{
  schemaVersion: 1;
  exportedAt: IsoTimestamp;
  preferences: ExportedPreferences;
  captures: readonly ExportCapture[];
  jobHistory: readonly ExportedJobHistory[];
}>;

export type ExportRequest =
  | Readonly<{ format: "json"; bundle: NonSecretExportBundle }>
  | Readonly<{
      format: "pdf";
      capture: CaptureRecord;
      report: ReportRecord;
      sources: readonly SourceRecord[];
    }>;

export type ExportArtifact = Readonly<{
  uri: string;
  fileName: string;
  mimeType: "application/json" | "application/pdf";
}>;

export interface ExportPort {
  create(request: ExportRequest): Promise<ExportArtifact>;
}

export interface SharePort {
  isAvailable(): Promise<boolean>;
  share(artifacts: readonly ExportArtifact[]): Promise<void>;
}

export type NotificationEvent =
  | Readonly<{ type: "processing-complete"; captureId: CaptureId }>
  | Readonly<{ type: "processing-failed"; captureId: CaptureId }>;

export interface NotificationPort {
  getPermission(): Promise<RecordingPermission | "provisional">;
  requestPermission(): Promise<RecordingPermission | "provisional">;
  /** notificationId is stable across retries, making delivery idempotent. */
  schedule(notificationId: string, event: NotificationEvent): Promise<void>;
  cancel(notificationId: string): Promise<void>;
}

export type DeleteTarget =
  | Readonly<{ kind: "capture"; captureId: CaptureId }>
  | Readonly<{ kind: "all-ideas" }>
  | Readonly<{ kind: "full-reset" }>;

export type DeletionRequest = Readonly<{
  operationId: string;
  target: DeleteTarget;
  requestedAt: IsoTimestamp;
}>;

export type DeletionTombstoneRecord = Readonly<{
  operationId: string;
  target: DeleteTarget;
  /** Generation installed by a global delete; capture deletes keep the current generation. */
  generation: DataGeneration;
  createdAt: IsoTimestamp;
}>;

export type CleanupStatus = "pending" | "running" | "retry-wait" | "failed";

export type CleanupQueueRecord = Readonly<{
  id: string;
  operationId: string;
  kind: "delete-audio";
  uri: string;
  status: CleanupStatus;
  attempts: number;
  runAfter: IsoTimestamp;
  lastError: NormalizedError | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}>;

export type DeletionReceipt = Readonly<{
  operationId: string;
  target: DeleteTarget;
  structuredDataDeleted: boolean;
  secureData: "not-applicable" | "deleted" | "failed";
  pendingAudioUris: readonly string[];
  failedAudioUris: readonly Readonly<{ uri: string; error: NormalizedError }>[];
}>;

/** Coordinates database tombstoning, secure-store clearing, and queued file deletion. */
export interface DataDeletionPort {
  execute(request: DeletionRequest): Promise<DeletionReceipt>;
  retry(operationId: string): Promise<DeletionReceipt>;
}

export type LocalDataChange = Readonly<{
  table:
    | "recording-drafts"
    | "captures"
    | "reports"
    | "sources"
    | "messages"
    | "discussion-drafts"
    | "jobs"
    | "preferences";
}>;

export interface LocalSubscriptionPort {
  subscribe(listener: (change: LocalDataChange) => void): () => void;
}
