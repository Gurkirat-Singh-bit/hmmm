/**
 * @file jobs.test.js
 * @description Verifies durable capture job selection, stable retry identity, and report planning.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, test } from "bun:test";

import {
  initialCaptureJobs,
  reportJob,
  transcriptionJob,
} from "../src/features/jobs/triggers";

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
const common = {
  captureId: "capture-1",
  generation: 1,
  revision: 1,
  requestId: "request-1",
  runAfter: new Date(0).toISOString(),
  maxAttempts: 3,
};

describe("durable capture job planning", () => {
  test("queues upload transcription without a final live transcript", () => {
    const jobs = initialCaptureJobs({
      ...common,
      audio,
      transcript: null,
      transcriptionRequestId: "transcribe-1",
      reportRequestId: "report-1",
      researchEnabled: true,
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload.kind).toBe("transcribe-capture");
  });

  test("queues report generation for a final live transcript", () => {
    const jobs = initialCaptureJobs({
      ...common,
      audio,
      transcript: {
        requestId: "live-1",
        phase: "final",
        revision: 2,
        text: "Captured words",
        languageTag: "en",
        segments: [],
        providerId: "deepgram",
        createdAt: new Date(0).toISOString(),
      },
      transcriptionRequestId: "transcribe-1",
      reportRequestId: "report-1",
      researchEnabled: false,
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload.kind).toBe("generate-report");
    expect(jobs[0].payload.transcriptRevision).toBe(2);
  });

  test("keeps retry request identity stable", () => {
    expect(
      transcriptionJob({ ...common, audio, expectedTranscriptRevision: 0 })
        .requestId,
    ).toBe("request-1");
    expect(
      reportJob({
        ...common,
        transcriptRevision: 1,
        expectedActiveRevision: null,
        researchEnabled: false,
        reason: "initial-capture",
        explicitlyReplacedUserFields: [],
      }).requestId,
    ).toBe("request-1");
  });
});
