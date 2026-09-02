/**
 * @file config.ts
 * @description Durable-job identity rules, retry limits, lease duration, and foreground polling defaults.
 * @author Gurkirat Singh
 * @license MIT
 */

export const JOB_RULES = {
  uniqueKey: ["captureId", "kind", "revision"],
  retriesKeepRequestId: true,
  retriesKeepRevision: true,
  explicitRegenerationUsesNewRevision: true,
  runningJobsRequireLease: true,
  jobWritesRequireCurrentGeneration: true,
  expiredLeasesReturnToQueued: true,
  tombstonedCaptureJobsAreCancelled: true,
  reportJobsPinExpectedActiveRevision: true,
} as const;

export const JOB_RUNTIME = {
  maxAttempts: 3,
  leaseMs: 5 * 60_000,
  idlePollMs: 5_000,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 60_000,
} as const;
