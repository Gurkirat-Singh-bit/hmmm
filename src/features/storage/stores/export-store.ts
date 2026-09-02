/**
 * @file export-store.ts
 * @description Focused SQLite export persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AppPreferencesRecord,
  ExportCapture,
  ExportedJobHistory,
  NonSecretExportBundle,
} from "../../domain/contracts";
import { SqliteStore } from "../connection";
import type { ExportSnapshotRepository } from "../contracts";
import {
  CaptureRow,
  JobRow,
  MessageRow,
  ReportRow,
  SourceRow,
  defaultPreferences,
  mapCapture,
  mapJob,
  mapMessage,
  mapReport,
  mapSource,
  requireUtc,
  supportedPreferences,
} from "./store-shared";
export class SqliteExportSnapshotRepository implements ExportSnapshotRepository {
  constructor(private readonly store: SqliteStore) {}
  readNonSecretBundle(exportedAt: string) {
    requireUtc(exportedAt);
    return this.store.readSnapshot(
      async (database): Promise<NonSecretExportBundle> => {
        const preferenceRow = await database.getFirstAsync<{
          value_json: string;
        }>(`SELECT value_json FROM preferences WHERE id = 'app'`);
        const preferences = supportedPreferences(
          preferenceRow
            ? (JSON.parse(preferenceRow.value_json) as AppPreferencesRecord)
            : defaultPreferences,
        );
        const captures = (
          await database.getAllAsync<CaptureRow>(
            "SELECT * FROM captures ORDER BY created_at, id",
          )
        ).map(mapCapture);
        const reports = (
          await database.getAllAsync<ReportRow>(
            "SELECT * FROM reports ORDER BY capture_id, revision",
          )
        ).map(mapReport);
        const sources = (
          await database.getAllAsync<SourceRow>(
            "SELECT * FROM sources ORDER BY capture_id, report_revision, id",
          )
        ).map(mapSource);
        const messages = (
          await database.getAllAsync<MessageRow>(
            "SELECT * FROM messages ORDER BY capture_id, created_at, id",
          )
        ).map(mapMessage);
        const jobs = (
          await database.getAllAsync<JobRow>(
            "SELECT * FROM jobs ORDER BY created_at, id",
          )
        ).map(mapJob);
        const exportedCaptures: ExportCapture[] = captures.map((capture) => {
          const { audio, generation: _generation, ...safeCapture } = capture;
          return {
            capture: { ...safeCapture, hasSourceAudio: audio !== null },
            reports: reports.filter(
              (report) => report.captureId === capture.id,
            ),
            sources: sources.filter(
              (source) => source.captureId === capture.id,
            ),
            messages: messages.filter(
              (message) => message.captureId === capture.id,
            ),
          };
        });
        const jobHistory: ExportedJobHistory[] = jobs.map((job) => ({
          id: job.id,
          captureId: job.captureId,
          kind: job.kind,
          revision: job.revision,
          requestId: job.requestId,
          status: job.status,
          attempts: job.attempts,
          lastError: job.lastError,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
        }));
        return {
          schemaVersion: 1,
          exportedAt,
          preferences: {
            displayName: preferences.displayName,
            languageTag: preferences.languageTag,
            researchEnabled: preferences.researchEnabled,
            researchConsent: preferences.researchConsent,
            notifications: preferences.notifications,
            speechProvider: preferences.speechProvider,
            aiProvider: preferences.aiProvider,
            customSystemPrompt: preferences.customSystemPrompt,
          },
          captures: exportedCaptures,
          jobHistory,
        };
      },
    );
  }
}
