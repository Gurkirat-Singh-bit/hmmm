/**
 * @file repositories.ts
 * @description Composes focused SQLite stores behind the application repository contract.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { AppRepositories } from "./contracts";
import { SqliteStore } from "./connection";
import {
  SqliteCaptureRepository,
  SqliteRecordingDraftRepository,
} from "./stores/capture-store";
import { SqliteCleanupQueueRepository } from "./stores/cleanup-store";
import { SqliteDeletionRepository } from "./stores/deletion-store";
import { SqliteExportSnapshotRepository } from "./stores/export-store";
import { SqliteJobRepository } from "./stores/job-store";
import {
  SqliteDiscussionDraftRepository,
  SqliteMessageRepository,
} from "./stores/message-store";
import { SqlitePreferencesRepository } from "./stores/preference-store";
import { SqliteReportRepository } from "./stores/report-store";

export { mapJob } from "./stores/store-shared";
export { SqliteCleanupQueueRepository } from "./stores/cleanup-store";
export { SqliteDeletionRepository } from "./stores/deletion-store";
export { SqliteJobRepository } from "./stores/job-store";

export type SqliteRepositories = AppRepositories &
  Readonly<{
    jobs: SqliteJobRepository;
    cleanup: SqliteCleanupQueueRepository;
    deletions: SqliteDeletionRepository;
  }>;

/** Creates explicit store implementations over one serialized SQLite connection. */
export function createSqliteRepositories(
  store: SqliteStore,
): SqliteRepositories {
  return {
    recordingDrafts: new SqliteRecordingDraftRepository(store),
    captures: new SqliteCaptureRepository(store),
    reports: new SqliteReportRepository(store),
    messages: new SqliteMessageRepository(store),
    discussionDrafts: new SqliteDiscussionDraftRepository(store),
    preferences: new SqlitePreferencesRepository(store),
    jobs: new SqliteJobRepository(store),
    cleanup: new SqliteCleanupQueueRepository(store),
    deletions: new SqliteDeletionRepository(store),
    exports: new SqliteExportSnapshotRepository(store),
  };
}
