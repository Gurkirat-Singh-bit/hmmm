/**
 * @file capture-service.ts
 * @description Coordinates recording state, durable draft recovery, and atomic capture job creation.
 * @author Gurkirat Singh
 * @license MIT
 */

import { File } from "expo-file-system";

import { DomainError, domainError, normalizeError } from "../domain/errors";
import { JOB_RUNTIME } from "../jobs/config";
import { initialCaptureJobs } from "../jobs/triggers";
import {
  captureAudioDirectory,
  inspectRecordingRecovery,
  promoteRecordingAudio,
  readRecoveredWav,
  type RecordingRecoveryCandidate,
} from "./recording/audio-storage";
import { RecordingLiveTranscription } from "./recording/live-transcription";
import { SiteedRecordingAdapter } from "./recording/siteed-recording";
import {
  bootAppRuntime,
  getRuntimeProcessingDependencies,
  notifyCaptureSaved,
  retryCaptureProcessing,
} from "../runtime/app-runtime";
import type { ProcessingHandlerDependencies } from "../jobs/handlers";
import type {
  AppPreferencesRecord,
  AudioAsset,
  CaptureRecord,
  DataGeneration,
  NormalizedError,
  RecordingDraftRecord,
  RecordingSessionPort,
  TranscriptSnapshot,
} from "../domain/contracts";
import type { LiveTranscriptEvent } from "../domain/providers";
import { findSpeechProvider } from "../onboarding/provider-config";
import { deepgramModelSupportsStreaming } from "../provider/model-discovery";
import type { CaptureHomeState, CapturePresentation } from "./state";

const initialPresentation: CapturePresentation = {
  phase: "idle",
  elapsedMs: 0,
  transcript: "",
  transcriptMode: "after-saving",
  message: null,
  canRetry: false,
};

export const initialCaptureState: CaptureHomeState = {
  capture: initialPresentation,
  recent: [],
};

type ActiveRecording = {
  readonly captureId: string;
  readonly draftId: string;
  readonly recoveryId: string;
  readonly generation: DataGeneration;
  readonly preferences: AppPreferencesRecord;
  readonly session: RecordingSessionPort;
  unsubscribe: () => void;
  live: RecordingLiveTranscription | null;
  draft: RecordingDraftRecord;
  finalLiveParts: string[];
};

type DiscoveredRecording = RecordingRecoveryCandidate &
  Readonly<{ location: "draft" | "capture" }>;
export class CaptureController {
  private readonly recorder = new SiteedRecordingAdapter();
  private readonly listeners = new Set<(state: CaptureHomeState) => void>();
  private processingDependencies: ProcessingHandlerDependencies | null = null;
  private unsubscribeDatabase: (() => void) | null = null;
  private active: ActiveRecording | null = null;
  private state = initialCaptureState;
  private initialization: Promise<void> | null = null;
  private action: Promise<void> | null = null;
  private draftWrite: Promise<void> = Promise.resolve();
  subscribe(listener: (state: CaptureHomeState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  async initialize() {
    if (!this.initialization) this.initialization = this.startup();
    try {
      await this.initialization;
    } catch (error) {
      this.failPresentation(error);
    }
  }
  async start() {
    await this.runExclusive(async () => {
      await this.initialize();
      this.publish({
        capture: {
          ...initialPresentation,
          phase: "permission",
          message: "Checking microphone access…",
        },
      });
      const permission = await this.recorder.getPermission();
      const granted =
        permission === "granted"
          ? permission
          : await this.recorder.requestPermission();
      if (granted !== "granted") {
        throw domainError(
          "permission-denied",
          "recording",
          "Microphone access is required to record. Allow it in Android settings, then try again.",
          true,
        );
      }

      const configured = await this.syncProfile(true);
      // Keep this epoch with the recording so a global delete can reject every
      // later draft, capture, and job write from this session.
      const generation = await this.repositories.deletions.getGeneration();
      const now = new Date().toISOString();
      const captureId = newCaptureId();
      const draft: RecordingDraftRecord = {
        id: captureId,
        captureId,
        generation,
        recoveryId: captureId,
        status: "recording",
        audio: null,
        transcript: null,
        durationMs: 0,
        error: null,
        createdAt: now,
        updatedAt: now,
      };

      // This durable row is intentionally written before the native microphone starts.
      await this.repositories.recordingDrafts.save(draft);
      this.publish({
        capture: {
          ...initialPresentation,
          phase: "starting",
          transcriptMode: "after-saving",
        },
      });
      let session: RecordingSessionPort;
      try {
        session = await this.recorder.start({
          draftId: draft.id,
          captureId,
          recoveryId: draft.recoveryId,
        });
      } catch (error) {
        // Keep the durable row so a native start that wrote partial audio can
        // still be reconciled on the next launch. Never discard its recovery
        // identity just because startup failed.
        await this.repositories.recordingDrafts
          .save({
            ...draft,
            status: "failed",
            error: normalizeError(error, "recording"),
            updatedAt: new Date().toISOString(),
          })
          .catch(() => undefined);
        throw error;
      }

      const active: ActiveRecording = {
        captureId,
        draftId: draft.id,
        recoveryId: draft.recoveryId,
        generation,
        preferences: configured.preferences,
        session,
        unsubscribe: () => undefined,
        live: null,
        draft,
        finalLiveParts: [],
      };
      active.unsubscribe = session.subscribe((event) => {
        if (event.type === "duration") {
          this.publish({
            capture: { ...this.state.capture, elapsedMs: event.durationMs },
          });
          return;
        }
        if (event.type === "state") {
          if (event.state === "paused")
            this.persistLater(active, { status: "paused" });
          if (event.state === "recording") {
            this.persistLater(active, { status: "recording" });
            this.publish({
              capture: {
                ...this.state.capture,
                phase: "recording",
                message: null,
              },
            });
          }
          return;
        }
        if (event.type === "interrupted")
          void this.recordingInterrupted(active, event.error);
      });
      this.active = active;
      this.publish({
        capture: {
          ...initialPresentation,
          phase: "recording",
          transcriptMode: "after-saving",
        },
      });
      void this.openLiveTranscript(active);
    });
  }
  async pause() {
    await this.runExclusive(async () => {
      const active = this.requireActive();
      await active.session.pause();
      await this.updateDraft(active, { status: "paused" });
      this.publish({
        capture: { ...this.state.capture, phase: "paused", message: null },
      });
    });
  }
  async resume() {
    await this.runExclusive(async () => {
      const active = this.requireActive();
      await active.session.resume();
      await this.updateDraft(active, { status: "recording" });
      this.publish({
        capture: { ...this.state.capture, phase: "recording", message: null },
      });
    });
  }
  async cancel() {
    await this.runExclusive(async () => {
      const active = this.requireActive();
      await active.live?.cancel();
      await active.session.cancel();
      await this.repositories.recordingDrafts.delete(
        active.draftId,
        active.generation,
      );
      active.unsubscribe();
      this.active = null;
      this.publish({ capture: initialPresentation });
    });
  }
  async finish() {
    await this.runExclusive(async () => {
      const active = this.requireActive();
      this.publish({
        capture: { ...this.state.capture, phase: "saving", message: null },
      });
      try {
        const audio = await active.session.finish();
        const liveFinal = await active.live?.finish();
        const transcript = provisionalLiveTranscript(
          active,
          liveFinal?.text ?? "",
          liveFinal?.languageTag ?? null,
        );

        // Persist the native URI before any file move. A crash here still leaves recoverable audio.
        await this.updateDraft(active, {
          status: "finalizing",
          audio,
          durationMs: audio.durationMs,
          transcript: transcript ?? active.draft.transcript,
        });
        const retainedAudio = promoteRecordingAudio(audio, active.captureId);
        await this.updateDraft(active, {
          audio: retainedAudio,
          durationMs: retainedAudio.durationMs,
        });

        const committedAt = new Date().toISOString();
        await this.repositories.captures.commitRecording({
          draftId: active.draftId,
          capture: {
            id: active.captureId,
            generation: active.generation,
            title: null,
            summary: null,
            kind: null,
            status: "queued",
            transcript: transcript ?? active.draft.transcript,
            audio: retainedAudio,
            durationMs: retainedAudio.durationMs,
            starred: false,
            activeReportRevision: null,
            error: null,
            createdAt: active.draft.createdAt,
            updatedAt: committedAt,
          },
          jobs: initialCaptureJobs({
            captureId: active.captureId,
            generation: active.generation,
            audio: retainedAudio,
            transcriptionRequestId: `${active.captureId}:transcription`,
            expectedTranscriptRevision:
              (transcript ?? active.draft.transcript)?.revision ?? 0,
            runAfter: committedAt,
            maxAttempts: JOB_RUNTIME.maxAttempts,
          }),
        });
        active.unsubscribe();
        this.active = null;
        this.publish({ capture: initialPresentation });
        // The capture is durable now; a stale recent-list read must not turn Saved into Failure.
        try {
          await this.refreshRecent();
        } catch {
          // The database subscription will refresh the list when reads recover.
        }
        // Saving the capture is authoritative. A runner wake failure must not
        // turn an already-saved capture back into a misleading recording error.
        try {
          await notifyCaptureSaved();
        } catch {
          // The database subscription and the next app foreground will retry.
        }
      } catch (error) {
        this.failPresentation(error);
      }
    });
  }
  async retry() {
    if (this.active) {
      if (
        this.active.session.getState() === "failed" ||
        this.active.session.getState() === "stopped"
      ) {
        this.active.unsubscribe();
        await this.active.live?.cancel();
        this.active = null;
        await this.reconcileInterruptedDrafts();
        await this.start();
        return;
      }
      await this.finish();
      return;
    }
    await this.start();
  }
  async retryCapture(captureId: string) {
    await this.runExclusive(async () => {
      await this.initialize();
      await this.syncProfile(true);
      if (await retryCaptureProcessing(captureId)) await this.refreshRecent();
    });
  }
  private async startup() {
    const appRuntime = await bootAppRuntime();
    this.processingDependencies = await getRuntimeProcessingDependencies();
    await this.syncProfile(false);
    this.unsubscribeDatabase = appRuntime.database.subscriptions.subscribe(
      (change) => {
        if (
          change.table === "captures" ||
          change.table === "jobs" ||
          change.table === "reports"
        )
          void this.refreshRecent();
      },
    );
    await this.reconcileInterruptedDrafts();
    await this.refreshRecent();
  }
  private async syncProfile(required: boolean) {
    const preferences = await this.repositories.preferences.get();
    const [speechCredential, aiCredential] = await Promise.all([
      this.secrets.readActive("speech"),
      this.secrets.readActive("ai"),
    ]);
    if (
      !speechCredential?.secret.trim() ||
      !preferences.speechProvider.model.trim() ||
      !aiCredential?.secret.trim() ||
      !preferences.aiProvider.model.trim()
    ) {
      if (required)
        throw domainError(
          "configuration-missing",
          "provider-configuration",
          "Finish configuring speech and AI providers before recording.",
          true,
        );
      return { preferences };
    }
    if (
      !safeEndpoint(preferences.speechProvider.endpoint) ||
      !safeEndpoint(preferences.aiProvider.endpoint)
    ) {
      if (required)
        throw domainError(
          "configuration-missing",
          "provider-configuration",
          "Provider endpoints must be valid HTTPS addresses.",
          true,
        );
      return { preferences };
    }
    const speech = this.providers.getSpeech(
      preferences.speechProvider.providerId,
    );
    const ai = this.providers.getAi(preferences.aiProvider.providerId);
    if (
      !speech?.descriptor.capabilities["speech.file-transcription"] ||
      !ai?.descriptor.capabilities["ai.report-generation"]
    ) {
      if (required)
        throw domainError(
          "configuration-missing",
          "provider-configuration",
          "Choose supported speech and AI providers before recording.",
          true,
        );
      return { preferences };
    }
    return { preferences };
  }
  private async openLiveTranscript(active: ActiveRecording) {
    if (active.session.supportsAudioChunks === false) return;
    if (active.preferences.speechProvider.providerId !== "deepgram") return;
    const provider = this.providers.getSpeech(
      active.preferences.speechProvider.providerId,
    );
    if (
      !provider?.descriptor.capabilities["speech.streaming-transcription"] ||
      !provider.openLiveSession
    )
      return;
    const apiKey =
      (await this.secrets.readActive("speech"))?.secret.trim() || null;
    const supportsStreaming = await deepgramModelSupportsStreaming(
      findSpeechProvider("deepgram"),
      apiKey ?? "",
      active.preferences.speechProvider.model,
    );
    const recordingState = active.session.getState();
    if (
      this.active !== active ||
      !supportsStreaming ||
      !apiKey ||
      (recordingState !== "recording" && recordingState !== "paused")
    )
      return;
    const live = new RecordingLiveTranscription(active.session, async () =>
      provider.openLiveSession!(
        {
          selection: active.preferences.speechProvider,
          apiKey,
        },
        {
          requestId: `${active.captureId}:live`,
          mimeType: "audio/pcm",
          languageTag: active.preferences.languageTag,
        },
      ),
    );
    active.live = live;
    live.subscribe((event) => this.liveEvent(active, event));
    this.publish({
      capture: {
        ...this.state.capture,
        transcriptMode: "live",
        message: null,
      },
    });
    live.start();
  }
  private liveEvent(active: ActiveRecording, event: LiveTranscriptEvent) {
    if (this.active !== active) return;
    if (event.type === "closed") {
      this.publish({
        capture: {
          ...this.state.capture,
          message: "Reconnecting live text. Your recording is still safe.",
        },
      });
      return;
    }
    const text = joinText(active.finalLiveParts, event.text);
    if (event.phase === "final") active.finalLiveParts.push(event.text);
    const transcript = provisionalTranscript(active, text);
    this.persistLater(active, { transcript });
    this.publish({
      capture: {
        ...this.state.capture,
        transcript: text,
        transcriptMode: "live",
        message: null,
      },
    });
  }
  private async recordingInterrupted(
    active: ActiveRecording,
    error: NormalizedError,
  ) {
    if (this.active !== active) return;
    try {
      await this.updateDraft(active, { status: "failed", error });
      await active.live?.cancel();
    } catch (cause) {
      this.failPresentation(cause);
      return;
    }
    this.failPresentation(error);
  }
  private async reconcileInterruptedDrafts() {
    const generation = await this.repositories.deletions.getGeneration();
    const drafts = await this.repositories.recordingDrafts.list();
    const candidates = discoveredRecordingAudio();
    for (const draft of drafts) {
      if (draft.generation !== generation) continue;
      const existing = await this.repositories.captures.get(draft.captureId);
      if (existing) {
        // A crash after the commit transaction can leave only a duplicate draft.
        // The committed capture owns its audio, so removing this row is safe.
        await this.repositories.recordingDrafts
          .delete(draft.id, generation)
          .catch(() => undefined);
        continue;
      }

      const candidate = candidateForDraft(draft, candidates);
      if (
        (!candidate || !candidate.audio) &&
        draft.status === "failed" &&
        draft.error
      )
        continue;
      const now = new Date().toISOString();
      const error =
        candidate?.error ??
        (candidate?.audio ? recoveredError(now) : missingRecordingError(now));
      const failedDraft: RecordingDraftRecord = {
        ...draft,
        status: "failed",
        audio: candidate?.audio ?? null,
        durationMs: candidate?.audio?.durationMs ?? draft.durationMs,
        error,
        updatedAt: now,
      };

      try {
        await this.repositories.recordingDrafts.save(failedDraft);
        if (!candidate?.audio) continue;

        const audio = promoteRecordingAudio(candidate.audio, draft.captureId);
        await this.repositories.recordingDrafts.save({
          ...failedDraft,
          audio,
          durationMs: audio.durationMs,
          updatedAt: new Date().toISOString(),
        });
        await this.repositories.captures.commitRecording({
          draftId: draft.id,
          capture: failedCapture(
            draft.captureId,
            draft.generation,
            draft.createdAt,
            audio,
            failedDraft.transcript,
            error,
          ),
          jobs: [],
        });
      } catch (cause) {
        // Recovery never deletes audio. Keep a durable failed draft even when
        // promotion or the capture commit cannot complete yet.
        await this.repositories.recordingDrafts
          .save({
            ...failedDraft,
            error: normalizeError(cause, "recording"),
            updatedAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
    }
  }
  private async updateDraft(
    active: ActiveRecording,
    patch: Partial<
      Omit<
        RecordingDraftRecord,
        "id" | "captureId" | "recoveryId" | "createdAt"
      >
    >,
  ) {
    active.draft = {
      ...active.draft,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const snapshot = active.draft;
    const write = this.draftWrite.then(() =>
      this.repositories.recordingDrafts.save(snapshot),
    );
    this.draftWrite = write.catch(() => undefined);
    await write;
  }
  private persistLater(
    active: ActiveRecording,
    patch: Partial<
      Omit<
        RecordingDraftRecord,
        "id" | "captureId" | "recoveryId" | "createdAt"
      >
    >,
  ) {
    void this.updateDraft(active, patch).catch((error) =>
      this.failPresentation(error),
    );
  }
  private async refreshRecent() {
    const recent = await this.repositories.captures.listRecent(3);
    this.publish({ recent });
  }

  private get repositories() {
    if (!this.processingDependencies)
      throw new Error("Capture storage has not been initialized.");
    return this.processingDependencies.repositories;
  }

  private get providers() {
    if (!this.processingDependencies)
      throw new Error("Capture providers have not been initialized.");
    return this.processingDependencies.providers;
  }

  private get secrets() {
    if (!this.processingDependencies)
      throw new Error("Capture secrets have not been initialized.");
    return this.processingDependencies.secrets;
  }
  private requireActive() {
    if (!this.active)
      throw domainError(
        "conflict",
        "recording",
        "There is no active recording to control.",
      );
    return this.active;
  }
  private failPresentation(error: unknown) {
    const detail =
      error instanceof DomainError
        ? error.detail
        : normalizeError(error, "recording");
    this.publish({
      capture: {
        ...this.state.capture,
        phase: detail.code === "permission-denied" ? "permission" : "failure",
        message: detail.message,
        canRetry: detail.retryable,
      },
    });
  }
  private publish(patch: Partial<CaptureHomeState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  private async runExclusive(task: () => Promise<void>) {
    if (this.action) return;
    const action = task();
    this.action = action;
    try {
      await action;
    } catch (error) {
      this.failPresentation(error);
    } finally {
      if (this.action === action) this.action = null;
    }
  }
}
function newCaptureId() {
  const value =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `capture-${value}`;
}
function safeEndpoint(value: string | null) {
  if (!value || !value.trim()) return true;
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search
    );
  } catch {
    return false;
  }
}
function joinText(parts: readonly string[], next: string) {
  return [...parts, next].join(" ").replace(/\s+/gu, " ").trim();
}
function provisionalTranscript(
  active: ActiveRecording,
  text: string,
): TranscriptSnapshot {
  const previous = active.draft.transcript;
  return {
    requestId: `${active.captureId}:live`,
    phase: "provisional",
    revision: (previous?.revision ?? 0) + 1,
    text,
    languageTag: active.preferences.languageTag,
    segments: [],
    providerId: active.preferences.speechProvider.providerId,
    createdAt: new Date().toISOString(),
  };
}
function provisionalLiveTranscript(
  active: ActiveRecording,
  text: string,
  languageTag: string | null,
): TranscriptSnapshot | null {
  if (!text.trim()) return null;
  return {
    requestId: `${active.captureId}:live:final`,
    phase: "provisional",
    revision: (active.draft.transcript?.revision ?? 0) + 1,
    text: text.trim(),
    languageTag,
    // The uploaded recording supplies authoritative timestamps after saving.
    segments: [],
    providerId: active.preferences.speechProvider.providerId,
    createdAt: new Date().toISOString(),
  };
}
function recoveryIdFromUri(uri: string) {
  const name = decodeURIComponent(uri)
    .split("/")
    .pop()
    ?.replace(/\.wav$/iu, "");
  return name && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(name) ? name : null;
}
function discoveredRecordingAudio() {
  let draftAudio: readonly DiscoveredRecording[] = [];
  try {
    draftAudio = inspectRecordingRecovery().map((candidate) => ({
      ...candidate,
      location: "draft" as const,
    }));
  } catch {
    // A filesystem read failure still gets represented by the durable draft.
  }
  try {
    const promotedAudio = captureAudioDirectory()
      .list()
      .filter(
        (entry): entry is File =>
          entry instanceof File && entry.extension.toLowerCase() === ".wav",
      )
      .map((file) => {
        try {
          return {
            uri: file.uri,
            audio: readRecoveredWav(file),
            error: null,
            location: "capture" as const,
          };
        } catch (error) {
          // Malformed app-owned audio is still an outcome, not an invisible
          // orphan. The file remains available for manual recovery/cleanup.
          return {
            uri: file.uri,
            audio: null,
            error: normalizeError(error, "recording"),
            location: "capture" as const,
          };
        }
      });
    return [...draftAudio, ...promotedAudio];
  } catch {
    return draftAudio;
  }
}
function candidateForDraft(
  draft: RecordingDraftRecord,
  candidates: readonly DiscoveredRecording[],
) {
  const ids = new Set([draft.id, draft.captureId, draft.recoveryId]);
  // Prefer an already-retained capture file when a crash left both copies.
  return (
    candidates.find(
      (candidate) =>
        candidate.location === "capture" &&
        candidate.audio &&
        recoveryIdFromUri(candidate.uri) === draft.captureId,
    ) ??
    candidates.find(
      (candidate) =>
        candidate.uri === draft.audio?.uri ||
        ids.has(recoveryIdFromUri(candidate.uri) ?? ""),
    ) ??
    null
  );
}
function recoveredError(occurredAt: string): NormalizedError {
  return {
    code: "recording-interrupted",
    operation: "recording",
    message:
      "We recovered this audio after recording was interrupted. Retry processing when ready.",
    retryable: true,
    occurredAt,
    providerId: null,
    statusCode: null,
  };
}
function missingRecordingError(occurredAt: string): NormalizedError {
  return {
    code: "storage-failed",
    operation: "recording",
    message:
      "The recording draft was recovered, but its audio file is missing. This failed draft remains available for recovery; record it again when ready.",
    retryable: true,
    occurredAt,
    providerId: null,
    statusCode: null,
  };
}
function failedCapture(
  captureId: string,
  generation: DataGeneration,
  createdAt: string,
  audio: AudioAsset,
  transcript: TranscriptSnapshot | null,
  error: NormalizedError,
): CaptureRecord {
  const now = new Date().toISOString();
  return {
    id: captureId,
    generation,
    title: null,
    summary: null,
    kind: null,
    status: "failed",
    transcript,
    audio,
    durationMs: audio.durationMs,
    starred: false,
    activeReportRevision: null,
    error,
    createdAt,
    updatedAt: now,
  };
}

let controllerPromise: Promise<CaptureController> | null = null;
export function captureController() {
  controllerPromise ??= Promise.resolve(new CaptureController());
  return controllerPromise;
}
