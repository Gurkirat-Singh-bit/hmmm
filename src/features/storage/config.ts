/**
 * @file config.ts
 * @description SQLite identity, schema version, persistence invariants, and cleanup retry limits.
 * @author Gurkirat Singh
 * @license MIT
 */

export const DATABASE_NAME = "hmmmidea.db";
export const SCHEMA_VERSION = 4;

export const DATABASE_RULES = {
  timestamps: "UTC ISO-8601",
  foreignKeys: "enabled",
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
    "reports(captureId, revision)",
    "reports(captureId, requestId)",
    "sources(captureId, reportRevision, url)",
    "messages(captureId, clientRequestId, role)",
    "messages(captureId, replyToMessageId) WHERE role = assistant",
    "discussionDrafts(captureId)",
    "jobs(captureId, kind, revision)",
    "cleanupQueue(operationId, uri)",
    "deletionTombstones(operationId)",
  ],
  captureCascadeDeletes: [
    "reports",
    "sources",
    "messages",
    "discussionDrafts",
    "jobs",
  ],
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
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 60_000,
  failedRowsMayBeRetriedBelowMaxAttempts: true,
  exhaustedRunningRowsBecomeFailed: true,
} as const;
