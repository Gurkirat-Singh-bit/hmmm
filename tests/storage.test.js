/**
 * @file storage.test.js
 * @description Verifies atomic SQLite writes, idempotency, revisions, deletion cascades, and secret-free exports.
 * @author Gurkirat Singh
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";

mock.module("expo-sqlite", () => ({
  addDatabaseChangeListener: () => ({ remove() {} }),
  openDatabaseAsync: async () => {
    throw new Error("Tests provide their own SQLite connection.");
  },
}));

const { migrateDatabase } = await import("../src/features/storage/schema");
const { SqliteStore } = await import("../src/features/storage/connection");
const { createSqliteRepositories } =
  await import("../src/features/storage/repositories");
const { reportJob } = await import("../src/features/jobs/triggers");

class BunSqliteAdapter {
  constructor(database) {
    this.database = database;
    this.databasePath = ":memory:";
  }

  async execAsync(sql) {
    this.database.exec(sql);
  }

  async runAsync(sql, parameters = []) {
    const result = this.database.query(sql).run(...parameters);
    return {
      changes: result.changes,
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync(sql, parameters = []) {
    return this.database.query(sql).get(...parameters) ?? null;
  }

  async getAllAsync(sql, parameters = []) {
    return this.database.query(sql).all(...parameters);
  }

  async withTransactionAsync(operation) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      await operation();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async closeAsync() {
    this.database.close();
  }
}

const now = "2026-01-01T00:00:00.000Z";
const audio = {
  uri: "file:///capture.wav",
  container: "wav",
  mimeType: "audio/wav",
  sampleRateHz: 16000,
  channelCount: 1,
  bitRateBps: 256000,
  durationMs: 1000,
  byteLength: 32000,
};
const transcript = {
  requestId: "transcript-1",
  phase: "final",
  revision: 1,
  text: "An offline-first idea.",
  languageTag: "en",
  segments: [],
  providerId: "deepgram",
  createdAt: now,
};

let database;
let store;
let repositories;

beforeEach(async () => {
  database = new Database(":memory:");
  const adapter = new BunSqliteAdapter(database);
  await migrateDatabase(adapter);
  store = new SqliteStore(adapter);
  repositories = createSqliteRepositories(store);
});

afterEach(async () => {
  await store.close();
});

async function commitCapture() {
  const draft = {
    id: "capture-1",
    captureId: "capture-1",
    generation: 0,
    recoveryId: "capture-1",
    status: "finalizing",
    audio,
    transcript,
    durationMs: audio.durationMs,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await repositories.recordingDrafts.save(draft);
  const job = reportJob({
    captureId: "capture-1",
    generation: 0,
    revision: 1,
    requestId: "report-job-1",
    transcriptRevision: 1,
    expectedActiveRevision: null,
    researchEnabled: false,
    reason: "initial-capture",
    explicitlyReplacedUserFields: [],
    runAfter: now,
    maxAttempts: 3,
  });
  const capture = {
    id: "capture-1",
    generation: 0,
    title: null,
    summary: null,
    kind: null,
    status: "queued",
    transcript,
    audio,
    durationMs: audio.durationMs,
    starred: false,
    activeReportRevision: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await repositories.captures.commitRecording({
    draftId: draft.id,
    capture,
    jobs: [job],
  });
  return { capture, job };
}

describe("SQLite repositories", () => {
  test("commits capture and job atomically and keeps enqueue idempotent", async () => {
    const { job } = await commitCapture();
    expect(await repositories.recordingDrafts.get("capture-1")).toBeNull();
    expect((await repositories.captures.get("capture-1")).status).toBe(
      "queued",
    );
    const original = (await repositories.jobs.listForCapture("capture-1"))[0];
    const repeated = await repositories.jobs.enqueue(job);
    expect(repeated.id).toBe(original.id);
    expect(await repositories.jobs.listForCapture("capture-1")).toHaveLength(1);
  });

  test("appends immutable report revisions", async () => {
    await commitCapture();
    const content = {
      gist: "Build it locally.",
      evidence: [],
      risks: ["Device loss"],
      nextMove: "Prototype backup export.",
      verdict: null,
    };
    const provenance = Object.fromEntries(
      ["gist", "evidence", "risks", "nextMove", "verdict"].map((field) => [
        field,
        {
          owner: "provider",
          origin: "ai-generated",
          sourceRevision: null,
          changedAt: now,
        },
      ]),
    );
    const first = await repositories.reports.appendRevision({
      captureId: "capture-1",
      expectedGeneration: 0,
      requestId: "report-1",
      expectedActiveRevision: null,
      phase: "final",
      origin: "ai-generated",
      transcriptRevision: 1,
      content,
      provenance,
      explicitlyReplacedUserFields: [],
      sources: [],
      providerId: "openai",
      model: "gpt-5-mini",
      captureUpdate: {
        title: "Offline idea",
        summary: "A local-first product",
        kind: "product",
        status: "ready",
        updatedAt: now,
      },
      createdAt: now,
    });
    const second = await repositories.reports.appendRevision({
      captureId: "capture-1",
      expectedGeneration: 0,
      requestId: "report-2",
      expectedActiveRevision: first.revision,
      phase: "final",
      origin: "user-edited",
      transcriptRevision: 1,
      content: { ...content, gist: "Keep every idea on device." },
      provenance: {
        ...provenance,
        gist: {
          owner: "user",
          origin: "user-edited",
          sourceRevision: 1,
          changedAt: now,
        },
      },
      explicitlyReplacedUserFields: ["gist"],
      sources: [],
      providerId: null,
      model: null,
      captureUpdate: null,
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect(
      (await repositories.reports.getActive("capture-1")).content.gist,
    ).toBe("Keep every idea on device.");
    expect(await repositories.reports.listRevisions("capture-1")).toHaveLength(
      2,
    );
  });

  test("cascades capture deletion and repeats the same operation safely", async () => {
    await commitCapture();
    await repositories.messages.appendUser({
      id: "message-1",
      captureId: "capture-1",
      expectedGeneration: 0,
      clientRequestId: "message-request-1",
      content: "Challenge this.",
      createdAt: now,
    });
    const request = {
      operationId: "delete-1",
      target: { kind: "capture", captureId: "capture-1" },
      requestedAt: now,
    };
    const first = await repositories.deletions.stage(request);
    const repeated = await repositories.deletions.stage(request);
    expect(repeated).toEqual(first);
    expect(await repositories.captures.get("capture-1")).toBeNull();
    expect(await repositories.messages.list("capture-1", 10, null)).toEqual([]);
    expect(await repositories.jobs.listForCapture("capture-1")).toEqual([]);
    expect(first.pendingAudioUris).toEqual([audio.uri]);
  });

  test("exports an explicit non-secret preference projection", async () => {
    const preferences = await repositories.preferences.get();
    await repositories.preferences.save({
      ...preferences,
      displayName: "Local user",
      speechProvider: {
        providerId: "openai",
        model: "whisper-1",
        endpoint: null,
      },
      aiProvider: { providerId: "openai", model: "gpt-5-mini", endpoint: null },
      apiKey: "must-not-export",
      updatedAt: now,
    });
    const bundle = await repositories.exports.readNonSecretBundle(now);
    expect(JSON.stringify(bundle)).not.toContain("must-not-export");
    expect(bundle.preferences.speechProvider.providerId).toBe("openai");
  });
});
