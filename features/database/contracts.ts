import type {
  AppPreferencesRecord,
  CaptureId,
  CaptureRecord,
  CaptureStatus,
  CleanupQueueRecord,
  DataGeneration,
  DeletionReceipt,
  DeletionRequest,
  DeletionTombstoneRecord,
  DiscussionDraftRecord,
  DraftId,
  IsoTimestamp,
  MessageId,
  MessageRecord,
  NonSecretExportBundle,
  NormalizedError,
  RecordingDraftRecord,
  ReportContent,
  ReportOrigin,
  ReportPhase,
  ReportField,
  ReportProvenance,
  ReportRecord,
  ReportRevision,
  ReportUpdateProposal,
  SourceRecord,
  TranscriptSnapshot,
} from '../domain/contracts';
import type { JobEnqueueInput, JobRecord, JobRepository } from '../jobs/contracts';

/** Runtime-visible persistence invariants shared by migrations and repositories. */
export const DATABASE_RULES = {
  timestamps: 'UTC ISO-8601',
  foreignKeys: 'enabled',
  globalGenerationBarrier: true,
  generationValidatedInsideWriteTransaction: true,
  processingStateAndJobEnqueueAreAtomic: true,
  ordinaryReadsExcludeTombstonedCaptures: true,
  reportRowsAreAppendOnly: true,
  activeReportMustBeFinal: true,
  sourceUrlsMustUseHttps: true,
  providerEndpointsMustBeHttpsAndCredentialFree: true,
  credentialsAllowedInSqlite: false,
  uniqueKeys: [
    'reports(captureId, revision)',
    'reports(captureId, requestId)',
    'sources(captureId, reportRevision, url)',
    'messages(captureId, clientRequestId, role)',
    'messages(captureId, replyToMessageId) WHERE role = assistant',
    'discussionDrafts(captureId)',
    'jobs(captureId, kind, revision)',
    'cleanupQueue(operationId, uri)',
    'deletionTombstones(operationId)',
  ],
  captureCascadeDeletes: ['reports', 'sources', 'messages', 'discussionDrafts', 'jobs'],
} as const;

export const TRANSCRIPT_RULES = {
  provisionalWritesRequireExpectedRevision: true,
  finalCanReplaceProvisional: true,
  finalCannotBeSilentlyOverwritten: true,
  retryUpdatesExistingCapture: true,
  sameRequestIdReturnsTheExistingFinal: true,
} as const;

export const REPORT_REVISION_RULES = {
  nextRevisionIsAllocatedInTransaction: true,
  snapshotsAreImmutable: true,
  provisionalRevisionNeverBecomesActive: true,
  finalRevisionAdvancesActivePointer: true,
  editAndRegenerationAppendNewRevision: true,
  regenerationPreservesUserOwnedFieldsUnlessExplicitlyReplaced: true,
  staleExpectedActiveRevisionIsConflict: true,
  sameRequestIdReturnsTheExistingRevision: true,
} as const;

export const DELETION_RULES = {
  tombstoneAndStructuredCascadeAreAtomic: true,
  globalDeletesAdvanceGenerationAtomically: true,
  staleGenerationWritesAreRejected: true,
  audioCleanupIsDurableAndRetryable: true,
  tombstonedRecordsAreHiddenImmediately: true,
  filesystemFailureNeverRestoresStructuredData: true,
  sameOperationIdIsIdempotent: true,
} as const;

export const CLEANUP_RULES = {
  maxAttempts: 5,
  failedRowsMayBeRetriedBelowMaxAttempts: true,
  exhaustedRunningRowsBecomeFailed: true,
} as const;

export type CaptureSort = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export type CaptureQuery = Readonly<{
  search: string;
  starred: boolean | null;
  statuses: readonly CaptureStatus[];
  sort: CaptureSort;
  limit: number | null;
  offset: number;
}>;

export interface RecordingDraftRepository {
  get(id: DraftId): Promise<RecordingDraftRecord | null>;
  list(): Promise<readonly RecordingDraftRecord[]>;
  save(draft: RecordingDraftRecord): Promise<void>;
  delete(id: DraftId, expectedGeneration: DataGeneration): Promise<void>;
}

export type CommitRecordingInput = Readonly<{
  draftId: DraftId;
  capture: CaptureRecord;
  jobs: readonly JobEnqueueInput[];
}>;

export interface CaptureRepository {
  get(id: CaptureId): Promise<CaptureRecord | null>;
  list(query: CaptureQuery): Promise<readonly CaptureRecord[]>;
  listRecent(limit: number): Promise<readonly CaptureRecord[]>;
  /** Atomically inserts the capture and jobs, then removes its draft. */
  commitRecording(input: CommitRecordingInput): Promise<CaptureRecord>;
  setStarred(id: CaptureId, starred: boolean, updatedAt: IsoTimestamp, expectedGeneration: DataGeneration): Promise<void>;
  setProcessingState(
    id: CaptureId,
    status: CaptureStatus,
    error: NormalizedError | null,
    updatedAt: IsoTimestamp,
    expectedGeneration: DataGeneration,
  ): Promise<void>;
  /** Atomically updates processing state and enqueues one idempotent job. */
  queueProcessing(input: Readonly<{
    id: CaptureId;
    status: CaptureStatus;
    error: NormalizedError | null;
    updatedAt: IsoTimestamp;
    expectedGeneration: DataGeneration;
    job: JobEnqueueInput;
  }>): Promise<JobRecord>;
  /** Uses expectedRevision to reject stale writes; a final transcript cannot be overwritten. */
  replaceTranscript(
    id: CaptureId,
    expectedRevision: number,
    transcript: TranscriptSnapshot,
    updatedAt: IsoTimestamp,
    expectedGeneration: DataGeneration,
  ): Promise<void>;
  /**
   * Atomically stores a final transcript and, when supplied, queues its report job.
   * A report job may be omitted only when this final snapshot supersedes a
   * provisional report; that report stays historical rather than regenerating silently.
   */
  completeTranscription(input: Readonly<{
    id: CaptureId;
    expectedRevision: number;
    expectedGeneration: DataGeneration;
    transcript: TranscriptSnapshot & Readonly<{ phase: 'final' }>;
    reportJob?: JobEnqueueInput;
    updatedAt: IsoTimestamp;
  }>): Promise<CaptureRecord>;
}

export type FinalReportCaptureUpdate = Readonly<{
  title: string;
  summary: string;
  kind: string;
  status: 'ready';
  updatedAt: IsoTimestamp;
}>;

export type AppendReportRevisionInput = Readonly<{
  captureId: CaptureId;
  expectedGeneration: DataGeneration;
  requestId: string;
  expectedActiveRevision: ReportRevision | null;
  phase: ReportPhase;
  origin: ReportOrigin;
  transcriptRevision: number;
  content: ReportContent;
  provenance: ReportProvenance;
  explicitlyReplacedUserFields: readonly ReportField[];
  sources: readonly Omit<SourceRecord, 'captureId' | 'reportRevision'>[];
  providerId: string | null;
  model: string | null;
  /** Used by report jobs to commit generated metadata and ready state in the same transaction. */
  captureUpdate: FinalReportCaptureUpdate | null;
  createdAt: IsoTimestamp;
}>;

export interface ReportRepository {
  get(captureId: CaptureId, revision: ReportRevision): Promise<ReportRecord | null>;
  getActive(captureId: CaptureId): Promise<ReportRecord | null>;
  getLatestProvisional(captureId: CaptureId): Promise<ReportRecord | null>;
  listRevisions(captureId: CaptureId): Promise<readonly ReportRecord[]>;
  listSources(captureId: CaptureId, revision: ReportRevision): Promise<readonly SourceRecord[]>;
  /**
   * Atomically allocates the next revision and inserts its sources. Final rows also
   * advance Capture.activeReportRevision; provisional rows never do.
   */
  appendRevision(input: AppendReportRevisionInput): Promise<ReportRecord>;
}

export type AppendUserMessageInput = Readonly<{
  id: MessageId;
  captureId: CaptureId;
  expectedGeneration: DataGeneration;
  clientRequestId: string;
  content: string;
  createdAt: IsoTimestamp;
}>;

export type AssistantRetryMode = 'restart' | 'resume';

export interface MessageRepository {
  list(captureId: CaptureId, limit: number, before: IsoTimestamp | null): Promise<readonly MessageRecord[]>;
  /** Returns the prior row when the same clientRequestId is retried. */
  appendUser(input: AppendUserMessageInput): Promise<MessageRecord>;
  /** Atomically persists a user turn and its sole assistant placeholder. */
  appendUserAndStartAssistant(input: AppendUserMessageInput & Readonly<{
    assistantId: MessageId;
  }>): Promise<Readonly<{ user: MessageRecord; assistant: MessageRecord }>>;
  /** Returns the prior assistant row when replyToMessageId already has one. */
  startAssistant(input: Readonly<{
    id: MessageId;
    captureId: CaptureId;
    expectedGeneration: DataGeneration;
    clientRequestId: string;
    replyToMessageId: MessageId;
    createdAt: IsoTimestamp;
  }>): Promise<MessageRecord>;
  /** Applies a delta only when nextSequence is exactly lastSequence + 1. */
  appendAssistantDelta(
    id: MessageId,
    expectedGeneration: DataGeneration,
    nextSequence: number,
    delta: string,
    updatedAt: IsoTimestamp,
  ): Promise<MessageRecord>;
  /** Reopens an interrupted or failed assistant row without creating another turn. */
  retryAssistant(
    id: MessageId,
    expectedGeneration: DataGeneration,
    mode: AssistantRetryMode,
    updatedAt: IsoTimestamp,
  ): Promise<MessageRecord>;
  finishAssistant(
    id: MessageId,
    expectedGeneration: DataGeneration,
    reportUpdateProposal: ReportUpdateProposal | null,
    updatedAt: IsoTimestamp,
  ): Promise<void>;
  interruptAssistant(id: MessageId, expectedGeneration: DataGeneration, error: NormalizedError, updatedAt: IsoTimestamp): Promise<void>;
}

export interface DiscussionDraftRepository {
  get(captureId: CaptureId): Promise<DiscussionDraftRecord | null>;
  save(draft: DiscussionDraftRecord): Promise<void>;
  delete(captureId: CaptureId, expectedGeneration: DataGeneration): Promise<void>;
}

export interface PreferencesRepository {
  get(): Promise<AppPreferencesRecord>;
  save(preferences: AppPreferencesRecord): Promise<void>;
}

export interface CleanupQueueRepository {
  /** Unique (operationId, uri) makes repeated deletion requests safe. */
  enqueue(record: CleanupQueueRecord): Promise<CleanupQueueRecord>;
  claimNext(now: IsoTimestamp): Promise<CleanupQueueRecord | null>;
  complete(id: string): Promise<void>;
  retry(id: string, runAfter: IsoTimestamp, error: NormalizedError): Promise<void>;
  fail(id: string, error: NormalizedError): Promise<void>;
  /** Requeues failed rows that have remaining bounded attempts. */
  requeueFailed(operationId: string, runAfter: IsoTimestamp): Promise<number>;
  listForOperation(operationId: string): Promise<readonly CleanupQueueRecord[]>;
}

export interface DeletionRepository {
  /** Current epoch; callers retain it across async work and pass it to writes. */
  getGeneration(): Promise<DataGeneration>;
  getTombstone(operationId: string): Promise<DeletionTombstoneRecord | null>;
  /**
   * One transaction: insert tombstone, enqueue referenced audio, cancel jobs,
   * and delete structured rows through foreign-key cascades. Additional URIs are
   * validated by LocalDataDeletion before they are supplied for global sweeps.
   * Repeating the same operationId returns the same receipt.
   */
  stage(request: DeletionRequest, additionalAudioUris?: readonly string[]): Promise<DeletionReceipt>;
  receipt(operationId: string): Promise<DeletionReceipt | null>;
}

export interface ExportSnapshotRepository {
  /** Reads one consistent SQLite snapshot. Secrets are unrepresentable in its result. */
  readNonSecretBundle(exportedAt: IsoTimestamp): Promise<NonSecretExportBundle>;
}

export interface AppRepositories {
  recordingDrafts: RecordingDraftRepository;
  captures: CaptureRepository;
  reports: ReportRepository;
  messages: MessageRepository;
  discussionDrafts: DiscussionDraftRepository;
  preferences: PreferencesRepository;
  jobs: JobRepository;
  cleanup: CleanupQueueRepository;
  deletions: DeletionRepository;
  exports: ExportSnapshotRepository;
}

/** Convenience snapshot for diagnostics; never part of user exports. */
export type ProcessingSnapshot = Readonly<{
  capture: CaptureRecord;
  jobs: readonly JobRecord[];
}>;
