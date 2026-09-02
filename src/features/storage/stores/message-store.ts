/**
 * @file message-store.ts
 * @description Focused SQLite message persistence operations.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  DataGeneration,
  DiscussionDraftRecord,
  MessageRecord,
  NormalizedError,
} from "../../domain/contracts";
import { domainError } from "../../domain/errors";
import { SqliteStore } from "../connection";
import type {
  AppendUserMessageInput,
  DiscussionDraftRepository,
  MessageRepository,
} from "../contracts";
import {
  MessageRow,
  getCapture,
  json,
  mapMessage,
  requireChanged,
  requireCurrentGeneration,
  requireGeneration,
  requireUtc,
} from "./store-shared";
export class SqliteMessageRepository implements MessageRepository {
  constructor(private readonly store: SqliteStore) {}
  async list(captureId: string, limit: number, before: string | null) {
    if (before) requireUtc(before);
    const rows = await this.store.read((database) =>
      database.getAllAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND (? IS NULL OR created_at < ?)
       ORDER BY created_at DESC, id DESC LIMIT ?`,
        [captureId, before, before, Math.max(0, limit)],
      ),
    );
    return rows.reverse().map(mapMessage);
  }
  appendUser(input: AppendUserMessageInput) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existing = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND client_request_id = ? AND role = 'user'`,
        [input.captureId, input.clientRequestId],
      );
      if (existing) {
        if (
          existing.generation !== input.expectedGeneration ||
          existing.content !== input.content
        ) {
          throw domainError(
            "conflict",
            "database",
            "This discussion request already contains another message.",
          );
        }
        return mapMessage(existing);
      }
      const capture = await getCapture(database, input.captureId);
      if (!capture)
        throw domainError("not-found", "database", "The capture was deleted.");
      if (capture.generation !== input.expectedGeneration)
        throw domainError(
          "cancelled",
          "database",
          "The discussion belongs to data that was deleted.",
        );
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'user', ?, 'complete', ?, NULL, ?, 0, NULL, NULL, ?, ?)`,
        [
          input.id,
          input.captureId,
          input.expectedGeneration,
          input.content,
          input.clientRequestId,
          capture.activeReportRevision,
          input.createdAt,
          input.createdAt,
        ],
      );
      return mapMessage(
        (await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [input.id],
        ))!,
      );
    });
  }
  appendUserAndStartAssistant(
    input: AppendUserMessageInput & Readonly<{ assistantId: string }>,
  ) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existingUser = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND client_request_id = ? AND role = 'user'`,
        [input.captureId, input.clientRequestId],
      );
      let user: MessageRecord;
      if (existingUser) {
        if (
          existingUser.generation !== input.expectedGeneration ||
          existingUser.content !== input.content
        ) {
          throw domainError(
            "conflict",
            "database",
            "This discussion request already contains another message.",
          );
        }
        user = mapMessage(existingUser);
      } else {
        const capture = await getCapture(database, input.captureId);
        if (!capture)
          throw domainError(
            "not-found",
            "database",
            "The capture was deleted.",
          );
        if (capture.generation !== input.expectedGeneration) {
          throw domainError(
            "cancelled",
            "database",
            "The discussion belongs to data that was deleted.",
          );
        }
        await database.runAsync(
          `INSERT INTO messages (
            id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
            report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
          ) VALUES (?, ?, ?, 'user', ?, 'complete', ?, NULL, ?, 0, NULL, NULL, ?, ?)`,
          [
            input.id,
            input.captureId,
            input.expectedGeneration,
            input.content,
            input.clientRequestId,
            capture.activeReportRevision,
            input.createdAt,
            input.createdAt,
          ],
        );
        user = mapMessage(
          (await database.getFirstAsync<MessageRow>(
            "SELECT * FROM messages WHERE id = ?",
            [input.id],
          ))!,
        );
      }

      const existingAssistant = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND reply_to_message_id = ? AND role = 'assistant'`,
        [input.captureId, user.id],
      );
      if (existingAssistant) {
        if (
          existingAssistant.generation !== input.expectedGeneration ||
          existingAssistant.client_request_id !== input.clientRequestId
        ) {
          throw domainError(
            "conflict",
            "database",
            "This user message already has another response request.",
          );
        }
        return { user, assistant: mapMessage(existingAssistant) };
      }

      const assistantIdCollision = await database.getFirstAsync<{ id: string }>(
        "SELECT id FROM messages WHERE id = ?",
        [input.assistantId],
      );
      if (assistantIdCollision) {
        throw domainError(
          "conflict",
          "database",
          "The assistant message ID is already in use.",
        );
      }
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'assistant', '', 'streaming', ?, ?, ?, 0, NULL, NULL, ?, ?)`,
        [
          input.assistantId,
          input.captureId,
          input.expectedGeneration,
          input.clientRequestId,
          user.id,
          user.reportRevision,
          input.createdAt,
          input.createdAt,
        ],
      );
      return {
        user,
        assistant: mapMessage(
          (await database.getFirstAsync<MessageRow>(
            "SELECT * FROM messages WHERE id = ?",
            [input.assistantId],
          ))!,
        ),
      };
    });
  }
  startAssistant(input: Parameters<MessageRepository["startAssistant"]>[0]) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existing = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND reply_to_message_id = ? AND role = 'assistant'`,
        [input.captureId, input.replyToMessageId],
      );
      if (existing) {
        if (
          existing.generation !== input.expectedGeneration ||
          existing.client_request_id !== input.clientRequestId
        ) {
          throw domainError(
            "conflict",
            "database",
            "This user message already has another response request.",
          );
        }
        return mapMessage(existing);
      }
      const parent = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND capture_id = ? AND role = 'user'`,
        [input.replyToMessageId, input.captureId],
      );
      if (!parent)
        throw domainError(
          "not-found",
          "database",
          "The user message was not found.",
        );
      if (parent.generation !== input.expectedGeneration)
        throw domainError(
          "cancelled",
          "database",
          "The discussion belongs to data that was deleted.",
        );
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'assistant', '', 'streaming', ?, ?, ?, 0, NULL, NULL, ?, ?)`,
        [
          input.id,
          input.captureId,
          input.expectedGeneration,
          input.clientRequestId,
          input.replyToMessageId,
          parent.report_revision,
          input.createdAt,
          input.createdAt,
        ],
      );
      return mapMessage(
        (await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [input.id],
        ))!,
      );
    });
  }
  appendAssistantDelta(
    id: string,
    expectedGeneration: DataGeneration,
    nextSequence: number,
    delta: string,
    updatedAt: string,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const row = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND role = 'assistant'`,
        [id],
      );
      if (!row)
        throw domainError(
          "not-found",
          "database",
          "The assistant message was not found.",
        );
      if (row.generation !== expectedGeneration)
        throw domainError(
          "cancelled",
          "database",
          "The discussion belongs to data that was deleted.",
        );
      if (nextSequence <= row.last_sequence) return mapMessage(row);
      if (
        nextSequence !== row.last_sequence + 1 ||
        !["queued", "streaming"].includes(row.status)
      ) {
        throw domainError(
          "conflict",
          "database",
          "The streamed response arrived out of order.",
        );
      }
      await database.runAsync(
        `UPDATE messages SET content = content || ?, status = 'streaming', last_sequence = ?, updated_at = ?
         WHERE id = ? AND generation = ?`,
        [delta, nextSequence, updatedAt, id, expectedGeneration],
      );
      return mapMessage(
        (await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [id],
        ))!,
      );
    });
  }
  retryAssistant(
    id: string,
    expectedGeneration: DataGeneration,
    mode: "restart" | "resume",
    updatedAt: string,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    if (mode !== "restart" && mode !== "resume") {
      throw domainError(
        "conflict",
        "database",
        "The assistant retry mode is invalid.",
      );
    }
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        `UPDATE messages SET
          content = CASE WHEN ? = 'restart' THEN '' ELSE content END,
          last_sequence = CASE WHEN ? = 'restart' THEN 0 ELSE last_sequence END,
          status = 'streaming', proposal_json = NULL, error_json = NULL, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ? AND status IN ('interrupted', 'failed')`,
        [mode, mode, updatedAt, id, expectedGeneration],
      );
      if (result.changes === 0) {
        const message = await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [id],
        );
        if (!message)
          throw domainError(
            "not-found",
            "database",
            "The assistant message was not found.",
          );
        throw domainError(
          "conflict",
          "database",
          "Only an interrupted or failed response can be retried.",
        );
      }
      return mapMessage(
        (await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [id],
        ))!,
      );
    });
  }
  finishAssistant(
    id: string,
    expectedGeneration: DataGeneration,
    proposal: MessageRecord["reportUpdateProposal"],
    updatedAt: string,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const message = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND role = 'assistant'`,
        [id],
      );
      if (!message)
        throw domainError(
          "not-found",
          "database",
          "The assistant message was not found.",
        );
      if (message.generation !== expectedGeneration)
        throw domainError(
          "cancelled",
          "database",
          "The discussion belongs to data that was deleted.",
        );
      if (
        proposal &&
        (proposal.captureId !== message.capture_id ||
          proposal.baseRevision !== message.report_revision)
      ) {
        throw domainError(
          "invalid-provider-output",
          "database",
          "The report proposal does not match this discussion.",
        );
      }
      if (message.status === "complete") {
        if (message.proposal_json !== (proposal ? json(proposal) : null)) {
          throw domainError(
            "conflict",
            "database",
            "The completed response cannot be replaced.",
          );
        }
        return;
      }
      if (message.status === "failed") {
        throw domainError(
          "conflict",
          "database",
          "A failed response cannot be completed.",
        );
      }
      const result = await database.runAsync(
        `UPDATE messages SET status = 'complete', proposal_json = ?, error_json = NULL, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ?`,
        [proposal ? json(proposal) : null, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, "The assistant message was not found.");
    });
  }
  interruptAssistant(
    id: string,
    expectedGeneration: DataGeneration,
    error: NormalizedError,
    updatedAt: string,
  ) {
    requireUtc(error.occurredAt, updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        `UPDATE messages SET status = 'interrupted', error_json = ?, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ? AND status IN ('queued', 'streaming', 'interrupted')`,
        [json(error), updatedAt, id, expectedGeneration],
      );
      if (result.changes === 0) {
        const message = await database.getFirstAsync<MessageRow>(
          "SELECT * FROM messages WHERE id = ?",
          [id],
        );
        if (message?.status === "complete") return;
        requireChanged(result, "The assistant message was not found.");
      }
    });
  }
}
export class SqliteDiscussionDraftRepository implements DiscussionDraftRepository {
  constructor(private readonly store: SqliteStore) {}
  async get(captureId: string) {
    const row = await this.store.read((database) =>
      database.getFirstAsync<{
        capture_id: string;
        generation: number;
        content: string;
        updated_at: string;
      }>("SELECT * FROM discussion_drafts WHERE capture_id = ?", [captureId]),
    );
    return row
      ? {
          captureId: row.capture_id,
          generation: row.generation,
          content: row.content,
          updatedAt: row.updated_at,
        }
      : null;
  }
  save(draft: DiscussionDraftRecord) {
    requireUtc(draft.updatedAt);
    requireGeneration(draft.generation);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, draft.generation);
      await database.runAsync(
        `INSERT INTO discussion_drafts (capture_id, generation, content, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(capture_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
         WHERE discussion_drafts.generation = excluded.generation`,
        [draft.captureId, draft.generation, draft.content, draft.updatedAt],
      );
    });
  }
  delete(captureId: string, expectedGeneration: DataGeneration) {
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        "DELETE FROM discussion_drafts WHERE capture_id = ? AND generation = ?",
        [captureId, expectedGeneration],
      );
    });
  }
}
