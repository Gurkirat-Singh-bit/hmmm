/**
 * @file report-store.ts
 * @description Focused SQLite report persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { SQLiteDatabase } from "expo-sqlite";

import type {
  ReportContent,
  ReportField,
  ReportProvenance,
  ReportRecord,
  SourceRecord,
} from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import { SqliteStore } from "../connection";
import type { AppendReportRevisionInput, ReportRepository } from "../contracts";
import {
  ReportRow,
  SourceRow,
  getCapture,
  json,
  mapReport,
  mapSource,
  reportFields,
  requireCurrentGeneration,
  requireGeneration,
  requireHttps,
  requireUtc,
} from "./store-shared";
async function getReport(
  database: SQLiteDatabase,
  captureId: string,
  revision: number,
) {
  const row = await database.getFirstAsync<ReportRow>(
    "SELECT * FROM reports WHERE capture_id = ? AND revision = ?",
    [captureId, revision],
  );
  return row ? mapReport(row) : null;
}
async function reportSources(
  database: SQLiteDatabase,
  captureId: string,
  revision: number,
) {
  const rows = await database.getAllAsync<SourceRow>(
    "SELECT * FROM sources WHERE capture_id = ? AND report_revision = ? ORDER BY id",
    [captureId, revision],
  );
  return rows.map(mapSource);
}
function mergeReport(
  input: AppendReportRevisionInput,
  active: ReportRecord | null,
): Readonly<{
  content: ReportContent;
  provenance: ReportProvenance;
  preservedEvidence: boolean;
}> {
  const explicit = new Set(input.explicitlyReplacedUserFields);
  const preserve = (field: ReportField) =>
    input.origin === "ai-generated" &&
    active?.provenance[field].owner === "user" &&
    !explicit.has(field);
  return {
    content: {
      gist: preserve("gist") ? active!.content.gist : input.content.gist,
      evidence: preserve("evidence")
        ? active!.content.evidence
        : input.content.evidence,
      risks: preserve("risks") ? active!.content.risks : input.content.risks,
      nextMove: preserve("nextMove")
        ? active!.content.nextMove
        : input.content.nextMove,
      verdict: preserve("verdict")
        ? active!.content.verdict
        : input.content.verdict,
    },
    provenance: {
      gist: preserve("gist") ? active!.provenance.gist : input.provenance.gist,
      evidence: preserve("evidence")
        ? active!.provenance.evidence
        : input.provenance.evidence,
      risks: preserve("risks")
        ? active!.provenance.risks
        : input.provenance.risks,
      nextMove: preserve("nextMove")
        ? active!.provenance.nextMove
        : input.provenance.nextMove,
      verdict: preserve("verdict")
        ? active!.provenance.verdict
        : input.provenance.verdict,
    },
    preservedEvidence: preserve("evidence"),
  };
}
function validateReport(
  content: ReportContent,
  provenance: ReportProvenance,
  sources: readonly SourceRecord[],
) {
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of sources) {
    requireUtc(
      source.accessedAt,
      ...(source.publishedAt ? [source.publishedAt] : []),
    );
    requireHttps(source);
    if (sourceIds.has(source.id) || sourceUrls.has(source.url)) {
      throw domainError(
        "conflict",
        "database",
        "Research sources must have unique IDs and URLs.",
      );
    }
    sourceIds.add(source.id);
    sourceUrls.add(source.url);
  }
  for (const evidence of content.evidence) {
    if (evidence.sourceIds.some((id) => !sourceIds.has(id))) {
      throw domainError(
        "invalid-provider-output",
        "database",
        "Report evidence references an unknown source.",
      );
    }
  }
  for (const field of reportFields) requireUtc(provenance[field].changedAt);
}
export class SqliteReportRepository implements ReportRepository {
  constructor(private readonly store: SqliteStore) {}
  get(captureId: string, revision: number) {
    return this.store.read((database) =>
      getReport(database, captureId, revision),
    );
  }
  async getActive(captureId: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<ReportRow>(
        `SELECT reports.* FROM reports
       JOIN captures ON captures.id = reports.capture_id AND captures.active_report_revision = reports.revision
       WHERE captures.id = ? AND reports.phase = 'final'`,
        [captureId],
      ),
    );
    return row ? mapReport(row) : null;
  }
  async getLatestProvisional(captureId: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<ReportRow>(
        `SELECT * FROM reports WHERE capture_id = ? AND phase = 'provisional'
       ORDER BY revision DESC LIMIT 1`,
        [captureId],
      ),
    );
    return row ? mapReport(row) : null;
  }
  async listRevisions(captureId: string) {
    const rows = await this.store.read((database) =>
      database.getAllAsync<ReportRow>(
        "SELECT * FROM reports WHERE capture_id = ? ORDER BY revision DESC",
        [captureId],
      ),
    );
    return rows.map(mapReport);
  }
  listSources(captureId: string, revision: number) {
    return this.store.read((database) =>
      reportSources(database, captureId, revision),
    );
  }
  appendRevision(input: AppendReportRevisionInput) {
    requireUtc(
      input.createdAt,
      ...(input.captureUpdate ? [input.captureUpdate.updatedAt] : []),
    );
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.captureId);
      if (!capture)
        throw domainError("not-found", "database", "The capture was deleted.");
      if (capture.generation !== input.expectedGeneration) {
        throw domainError(
          "cancelled",
          "database",
          "The report belongs to data that was deleted.",
        );
      }
      const existing = await database.getFirstAsync<ReportRow>(
        "SELECT * FROM reports WHERE capture_id = ? AND request_id = ?",
        [input.captureId, input.requestId],
      );
      if (existing) {
        if (
          existing.phase !== input.phase ||
          existing.transcript_revision !== input.transcriptRevision
        ) {
          throw domainError(
            "conflict",
            "database",
            "This report request already belongs to another revision.",
          );
        }
        return mapReport(existing);
      }

      if (
        capture.transcript?.phase !== input.phase ||
        capture.transcript.revision !== input.transcriptRevision
      ) {
        throw domainError(
          "conflict",
          "database",
          `Reports require the matching ${input.phase} transcript.`,
        );
      }
      if (capture.activeReportRevision !== input.expectedActiveRevision) {
        throw domainError(
          "conflict",
          "database",
          "The report changed before this revision was saved.",
        );
      }
      if (input.phase === "provisional" && input.captureUpdate) {
        throw domainError(
          "conflict",
          "database",
          "A provisional report cannot mark a capture ready.",
        );
      }

      const active =
        capture.activeReportRevision === null
          ? null
          : await getReport(
              database,
              input.captureId,
              capture.activeReportRevision,
            );
      const merged = mergeReport(input, active);
      const sourceInputs: SourceRecord[] = input.sources.map((source) => ({
        ...source,
        captureId: input.captureId,
        reportRevision: 0,
      }));
      if (merged.preservedEvidence && active) {
        const required = new Set(
          active.content.evidence.flatMap((item) => item.sourceIds),
        );
        for (const source of await reportSources(
          database,
          active.captureId,
          active.revision,
        )) {
          if (!required.has(source.id)) continue;
          const duplicateIndex = sourceInputs.findIndex(
            (candidate) =>
              candidate.id === source.id || candidate.url === source.url,
          );
          if (duplicateIndex >= 0) sourceInputs.splice(duplicateIndex, 1);
          sourceInputs.push({ ...source, reportRevision: 0 });
        }
      }
      validateReport(merged.content, merged.provenance, sourceInputs);

      const latest = await database.getFirstAsync<{ revision: number }>(
        "SELECT MAX(revision) AS revision FROM reports WHERE capture_id = ?",
        [input.captureId],
      );
      const revision = (latest?.revision ?? 0) + 1;
      await database.runAsync(
        `INSERT INTO reports (
          capture_id, generation, revision, request_id, phase, origin, supersedes_revision, transcript_revision,
          content_json, provenance_json, provider_id, model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.captureId,
          input.expectedGeneration,
          revision,
          input.requestId,
          input.phase,
          input.origin,
          input.expectedActiveRevision,
          input.transcriptRevision,
          json(merged.content),
          json(merged.provenance),
          input.providerId,
          input.model,
          input.createdAt,
        ],
      );
      for (const source of sourceInputs) {
        await database.runAsync(
          `INSERT INTO sources (
            capture_id, report_revision, id, title, url, domain, published_at, accessed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.captureId,
            revision,
            source.id,
            source.title,
            source.url,
            source.domain,
            source.publishedAt,
            source.accessedAt,
          ],
        );
      }
      if (input.phase === "final") {
        await database.runAsync(
          `UPDATE captures SET
            active_report_revision = ?, title = COALESCE(title, ?), summary = COALESCE(?, summary),
            kind = COALESCE(?, kind), status = COALESCE(?, status), error_json = NULL, updated_at = ?
           WHERE id = ?`,
          [
            revision,
            input.captureUpdate?.title ?? null,
            input.captureUpdate?.summary ?? null,
            input.captureUpdate?.kind ?? null,
            input.captureUpdate?.status ?? null,
            input.captureUpdate?.updatedAt ?? input.createdAt,
            input.captureId,
          ],
        );
      }
      return (await getReport(database, input.captureId, revision))!;
    });
  }
}
