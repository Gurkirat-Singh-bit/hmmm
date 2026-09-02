/**
 * @file providers.ts
 * @description Provider-facing domain requests, responses, capabilities, and ports.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AudioAsset,
  CaptureId,
  IsoTimestamp,
  MessageId,
  ProviderSelection,
  ReportContent,
  ReportUpdateProposal,
  SourceRecord,
  TranscriptSegment,
} from "./contracts";

export type ProviderKind = "speech" | "ai";

export type ProviderCapability =
  | "speech.file-transcription"
  | "speech.streaming-transcription"
  | "ai.report-generation"
  | "ai.research-with-citations"
  | "ai.discussion"
  | "ai.discussion-streaming";

/** All keys are required so an adapter cannot leave support ambiguous. */
export type ProviderCapabilities = Readonly<
  Record<ProviderCapability, boolean>
>;

export type ProviderDescriptor = Readonly<{
  id: string;
  kind: ProviderKind;
  capabilities: ProviderCapabilities;
}>;

export type ProviderRoute =
  | "capture.live-transcript"
  | "capture.saved-transcript"
  | "report.generate"
  | "report.generate-with-research"
  | "discussion.complete"
  | "discussion.stream";

export type ProviderRoutingRule = Readonly<{
  providerKind: ProviderKind;
  requires: readonly ProviderCapability[];
  fallback: ProviderRoute | null;
}>;

/** The single routing table used by UI capability copy, jobs, and provider dispatch. */
export const PROVIDER_ROUTING_MATRIX = {
  "capture.live-transcript": {
    providerKind: "speech",
    requires: ["speech.streaming-transcription"],
    fallback: "capture.saved-transcript",
  },
  "capture.saved-transcript": {
    providerKind: "speech",
    requires: ["speech.file-transcription"],
    fallback: null,
  },
  "report.generate": {
    providerKind: "ai",
    requires: ["ai.report-generation"],
    fallback: null,
  },
  "report.generate-with-research": {
    providerKind: "ai",
    requires: ["ai.report-generation", "ai.research-with-citations"],
    fallback: null,
  },
  "discussion.complete": {
    providerKind: "ai",
    requires: ["ai.discussion"],
    fallback: null,
  },
  "discussion.stream": {
    providerKind: "ai",
    requires: ["ai.discussion", "ai.discussion-streaming"],
    fallback: "discussion.complete",
  },
} as const satisfies Record<ProviderRoute, ProviderRoutingRule>;

/** Ephemeral call context. It must never be persisted or logged. */
export type ProviderContext = Readonly<{
  selection: ProviderSelection;
  apiKey: string | null;
}>;

export type TranscriptionRequest = Readonly<{
  requestId: string;
  audio: AudioAsset;
  languageTag: string | null;
}>;

export type FinalTranscript = Readonly<{
  text: string;
  languageTag: string | null;
  segments: readonly TranscriptSegment[];
}>;

export type LiveTranscriptEvent =
  | Readonly<{
      type: "transcript";
      phase: "provisional" | "final";
      text: string;
      sequence: number;
    }>
  | Readonly<{ type: "closed" }>;

export interface LiveTranscriptionSessionPort {
  subscribe(listener: (event: LiveTranscriptEvent) => void): () => void;
  sendAudio(chunk: Uint8Array, sequence: number): Promise<void>;
  finish(): Promise<FinalTranscript>;
  cancel(): Promise<void>;
}

export interface SpeechProviderPort {
  readonly descriptor: ProviderDescriptor & Readonly<{ kind: "speech" }>;
  /** Present exactly when speech.file-transcription is true. */
  transcribe?: (
    context: ProviderContext,
    request: TranscriptionRequest,
  ) => Promise<FinalTranscript>;
  /** Present exactly when speech.streaming-transcription is true. */
  openLiveSession?: (
    context: ProviderContext,
    request: Readonly<{
      requestId: string;
      mimeType: string;
      languageTag: string | null;
    }>,
  ) => Promise<LiveTranscriptionSessionPort>;
}

export type ResearchSource = Omit<SourceRecord, "captureId" | "reportRevision">;

export type ResearchFinding = Readonly<{
  id: string;
  text: string;
  sourceIds: readonly string[];
}>;

export type ResearchResult = Readonly<{
  findings: readonly ResearchFinding[];
  sources: readonly ResearchSource[];
}>;

export type ReportGenerationRequest = Readonly<{
  requestId: string;
  captureId: CaptureId;
  transcript: string;
  transcriptRevision: number;
  languageTag: string;
  research: ResearchResult | null;
  systemPrompt: string | null;
}>;

export type GeneratedReport = Readonly<{
  title: string;
  summary: string;
  kind: string;
  content: ReportContent;
  sources: readonly ResearchSource[];
}>;

export type ResearchRequest = Readonly<{
  requestId: string;
  captureId: CaptureId;
  transcript: string;
  languageTag: string;
}>;

export type DiscussionContextMessage = Readonly<{
  id: MessageId;
  role: "user" | "assistant";
  content: string;
}>;

export type DiscussionRequest = Readonly<{
  /** Stable across retries of one user turn. */
  requestId: string;
  captureId: CaptureId;
  replyToMessageId: MessageId;
  transcript: string;
  report: ReportContent | null;
  reportRevision: number | null;
  messages: readonly DiscussionContextMessage[];
  languageTag: string;
  systemPrompt: string | null;
}>;

export type DiscussionResponse = Readonly<{
  content: string;
  reportUpdateProposal: ReportUpdateProposal | null;
  completedAt: IsoTimestamp;
}>;

export type DiscussionStreamEvent =
  | Readonly<{ type: "delta"; sequence: number; content: string }>
  | Readonly<{
      type: "complete";
      sequence: number;
      reportUpdateProposal: ReportUpdateProposal | null;
      completedAt: IsoTimestamp;
    }>;

export interface AiProviderPort {
  readonly descriptor: ProviderDescriptor & Readonly<{ kind: "ai" }>;
  /** Present exactly when ai.research-with-citations is true. */
  research?: (
    context: ProviderContext,
    request: ResearchRequest,
  ) => Promise<ResearchResult>;
  /** Present exactly when ai.report-generation is true. */
  generateReport?: (
    context: ProviderContext,
    request: ReportGenerationRequest,
  ) => Promise<GeneratedReport>;
  /** Present exactly when ai.discussion is true. */
  completeDiscussion?: (
    context: ProviderContext,
    request: DiscussionRequest,
  ) => Promise<DiscussionResponse>;
  /** Present exactly when ai.discussion-streaming is true. */
  streamDiscussion?: (
    context: ProviderContext,
    request: DiscussionRequest,
  ) => AsyncIterable<DiscussionStreamEvent>;
}

export interface ProviderRegistryPort {
  getSpeech(providerId: string): SpeechProviderPort | null;
  getAi(providerId: string): AiProviderPort | null;
}
