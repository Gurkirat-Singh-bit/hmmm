/**
 * @file triggers.ts
 * @description Builds idempotent durable jobs for new captures and report regeneration.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AudioAsset,
  CaptureId,
  DataGeneration,
  ReportField,
  ReportRevision,
  TranscriptSnapshot,
} from "../domain/contracts";
import type { JobEnqueueInput, ReportJobPayload } from "./contracts";

type CommonTrigger = Readonly<{
  captureId: CaptureId;
  generation: DataGeneration;
  revision: number;
  requestId: string;
  runAfter: string;
  maxAttempts: number;
}>;
export function transcriptionJob(
  input: CommonTrigger &
    Readonly<{ audio: AudioAsset; expectedTranscriptRevision: number }>,
): JobEnqueueInput {
  return {
    captureId: input.captureId,
    generation: input.generation,
    revision: input.revision,
    requestId: input.requestId,
    runAfter: input.runAfter,
    maxAttempts: input.maxAttempts,
    payload: {
      kind: "transcribe-capture",
      audio: input.audio,
      expectedTranscriptRevision: input.expectedTranscriptRevision,
    },
  };
}
export function reportJob(
  input: CommonTrigger &
    Readonly<{
      transcriptRevision: number;
      expectedActiveRevision: ReportRevision | null;
      researchEnabled: boolean;
      reason: ReportJobPayload["reason"];
      explicitlyReplacedUserFields: readonly ReportField[];
    }>,
): JobEnqueueInput {
  return {
    captureId: input.captureId,
    generation: input.generation,
    revision: input.revision,
    requestId: input.requestId,
    runAfter: input.runAfter,
    maxAttempts: input.maxAttempts,
    payload: {
      kind: "generate-report",
      transcriptRevision: input.transcriptRevision,
      expectedActiveRevision: input.expectedActiveRevision,
      researchEnabled: input.researchEnabled,
      reason: input.reason,
      explicitlyReplacedUserFields: input.explicitlyReplacedUserFields,
    },
  };
}
export function initialCaptureJobs(
  input: Readonly<{
    captureId: CaptureId;
    generation: DataGeneration;
    audio: AudioAsset;
    transcript: TranscriptSnapshot | null;
    transcriptionRequestId: string;
    reportRequestId: string;
    researchEnabled: boolean;
    runAfter: string;
    maxAttempts: number;
  }>,
): readonly JobEnqueueInput[] {
  if (input.transcript?.phase === "final") {
    return [
      reportJob({
        captureId: input.captureId,
        generation: input.generation,
        revision: 1,
        requestId: input.reportRequestId,
        transcriptRevision: input.transcript.revision,
        expectedActiveRevision: null,
        researchEnabled: input.researchEnabled,
        reason: "initial-capture",
        explicitlyReplacedUserFields: [],
        runAfter: input.runAfter,
        maxAttempts: input.maxAttempts,
      }),
    ];
  }
  return [
    transcriptionJob({
      captureId: input.captureId,
      generation: input.generation,
      revision: 1,
      requestId: input.transcriptionRequestId,
      audio: input.audio,
      expectedTranscriptRevision: input.transcript?.revision ?? 0,
      runAfter: input.runAfter,
      maxAttempts: input.maxAttempts,
    }),
  ];
}
