/**
 * @file research-handler.test.js
 * @description Verifies explicit report research routing and stable provider identities.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, test } from "bun:test";

import { createReportHandler } from "../src/features/jobs/handlers";

const now = "2026-01-01T00:00:00.000Z";
const result = {
  findings: [
    { id: "finding-1", text: "Supported fact", sourceIds: ["source-1"] },
  ],
  sources: [
    {
      id: "source-1",
      title: "Source",
      url: "https://example.com/source",
      domain: "example.com",
      publishedAt: null,
      accessedAt: now,
    },
  ],
};

function harness(researchSource, options = {}) {
  const calls = [];
  const capture = {
    id: "capture-1",
    generation: 0,
    title: null,
    summary: null,
    kind: null,
    status: "queued",
    transcript: {
      requestId: "transcript-1",
      phase: "final",
      revision: 1,
      text: "Build a local voice idea app.",
      languageTag: "en",
      segments: [],
      providerId: "deepgram",
      createdAt: now,
    },
    audio: null,
    durationMs: 1,
    starred: false,
    activeReportRevision: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const providerId = researchSource.kind === "external" ? "custom" : "openai";
  const capabilities = {
    "speech.file-transcription": false,
    "speech.streaming-transcription": false,
    "ai.report-generation": true,
    "ai.research-with-citations": researchSource.kind === "ai-native",
    "ai.discussion": true,
    "ai.discussion-streaming": true,
  };
  const ai = {
    descriptor: { id: providerId, kind: "ai", capabilities },
    async planResearchQuery(_context, request) {
      calls.push(["plan", request.requestId]);
      return "local voice notes market alternatives";
    },
    async research(_context, request) {
      calls.push(["native", request.requestId]);
      return result;
    },
    async generateReport(_context, request) {
      calls.push(["report", request.requestId, request.research]);
      return {
        title: "Local ideas",
        summary: "A voice-first idea app.",
        kind: "product",
        content: {
          gist: "Capture ideas locally.",
          evidence: request.research
            ? [
                {
                  id: "evidence-1",
                  text: "Supported fact",
                  sourceIds: ["source-1"],
                },
              ]
            : [],
          risks: ["Provider availability"],
          nextMove: "Prototype it.",
          verdict: null,
        },
        sources: request.research?.sources ?? [],
      };
    },
  };
  let appended = null;
  const search = {
    descriptor: { id: "serpapi", kind: "search" },
    async probe() {},
    async search(_context, request) {
      calls.push(["search", request.requestId, request.query]);
      if (options.searchFailure) throw options.searchFailure;
      return result;
    },
  };
  const preferences = {
    id: "app",
    displayName: "User",
    languageTag: "en",
    onboardingComplete: true,
    researchEnabled: true,
    researchConsent: {
      status: "granted",
      policyVersion: "research-transfer-v2",
      decidedAt: now,
    },
    researchSource,
    notifications: {
      enabled: false,
      reportReady: true,
      processingFailed: true,
    },
    speechProvider: { providerId: "deepgram", model: "nova-3", endpoint: null },
    aiProvider: { providerId, model: "report-model", endpoint: null },
    customSystemPrompt: null,
    updatedAt: now,
  };
  const dependencies = {
    repositories: {
      captures: {
        async get() {
          return capture;
        },
        async setProcessingState(...args) {
          calls.push(["state", ...args.slice(1, 2)]);
        },
      },
      reports: {
        async getActive() {
          return null;
        },
        async appendRevision(input) {
          appended = input;
          return { revision: 1 };
        },
      },
      preferences: {
        async get() {
          return preferences;
        },
      },
    },
    providers: {
      getSpeech() {
        return null;
      },
      getAi() {
        return ai;
      },
      getSearch(id) {
        return id === "serpapi" ? search : null;
      },
    },
    secrets: {
      async readActive(kind) {
        if (kind === "search" && options.missingSearchKey) return null;
        return { kind, version: `${kind}-1`, secret: `${kind}-secret` };
      },
    },
    now: () => new Date(now),
  };
  const job = {
    id: "job-1",
    kind: "generate-report",
    captureId: "capture-1",
    generation: 0,
    revision: 1,
    requestId: "report-request-1",
    payload: {
      kind: "generate-report",
      transcriptRevision: 1,
      expectedActiveRevision: null,
      researchEnabled: true,
      reason: "initial-capture",
      explicitlyReplacedUserFields: [],
    },
  };
  return {
    calls,
    capture,
    job,
    getAppended: () => appended,
    run: () => createReportHandler(dependencies).run(job),
  };
}

describe("report research routing", () => {
  test("plans one query and performs one SerpApi search with stable IDs", async () => {
    const subject = harness({
      kind: "external",
      providerId: "serpapi",
      engine: "google",
    });
    await subject.run();
    expect(subject.calls.filter(([kind]) => kind === "plan")).toEqual([
      ["plan", "report-request-1:research:plan"],
    ]);
    expect(subject.calls.filter(([kind]) => kind === "search")).toEqual([
      [
        "search",
        "report-request-1:research:search",
        "local voice notes market alternatives",
      ],
    ]);
    expect(subject.getAppended().sources).toEqual(result.sources);
  });

  test("keeps AI-native research on the selected AI provider", async () => {
    const subject = harness({ kind: "ai-native" });
    await subject.run();
    expect(subject.calls.filter(([kind]) => kind === "native")).toEqual([
      ["native", "report-request-1:research"],
    ]);
    expect(subject.calls.some(([kind]) => kind === "plan")).toBe(false);
    expect(subject.calls.some(([kind]) => kind === "search")).toBe(false);
  });

  test("does not fall back or overwrite the capture after search failure", async () => {
    const failure = new Error("SerpApi failed");
    const subject = harness(
      { kind: "external", providerId: "serpapi", engine: "google" },
      { searchFailure: failure },
    );
    await expect(subject.run()).rejects.toBe(failure);
    expect(subject.calls.some(([kind]) => kind === "native")).toBe(false);
    expect(subject.calls.some(([kind]) => kind === "report")).toBe(false);
    expect(subject.getAppended()).toBeNull();
    expect(subject.capture.transcript.text).toBe(
      "Build a local voice idea app.",
    );
  });

  test("stops before query planning when the SerpApi key is missing", async () => {
    const subject = harness(
      { kind: "external", providerId: "serpapi", engine: "google" },
      { missingSearchKey: true },
    );
    await expect(subject.run()).rejects.toThrow("Add a SerpApi key");
    expect(subject.calls.some(([kind]) => kind === "plan")).toBe(false);
  });
});
