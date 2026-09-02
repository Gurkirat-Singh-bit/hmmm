/**
 * @file app-runtime.ts
 * @description Bootstraps repositories, providers, capture services, jobs, and app subscriptions.
 * @author Gurkirat Singh
 * @license MIT
 */

import { AppState, Platform } from "react-native";
import { useEffect, useState } from "react";

import { LocalDataDeletion } from "@/features/storage/deletion";
import { openAppDatabase, type AppDatabase } from "@/features/storage/database";
import type {
  AppPreferencesRecord,
  DataDeletionPort,
} from "@/features/domain/contracts";
import { domainError, normalizeError } from "@/features/domain/errors";
import {
  createReportHandler,
  createTerminalFailureHandler,
  createTranscriptionHandler,
  type ProcessingHandlerDependencies,
} from "@/features/jobs/handlers";
import type { JobHandler } from "@/features/jobs/contracts";
import { ForegroundJobRunner } from "@/features/jobs/runner";
import { reportJob, transcriptionJob } from "@/features/jobs/triggers";
import { JOB_RUNTIME } from "@/features/jobs/config";
import {
  androidNotificationPort,
  cancelPendingGenericNotifications,
} from "@/features/notifications/android-notifications";
import {
  readPreferences,
  providerCredentials,
} from "@/features/onboarding/storage";
import { providerRegistry } from "@/features/provider/registry";
import { reconcileExportArtifacts } from "@/features/export/export-service";
import {
  AppOwnedAudioFiles,
  isAppOwnedAudioUri,
} from "@/features/capture/recording/audio-storage";

export type AppRuntimeStatus = "idle" | "hydrating" | "ready" | "error";

export type AppRuntimeSnapshot = Readonly<{
  status: AppRuntimeStatus;
  onboardingComplete: boolean;
  preferences: AppPreferencesRecord | null;
  error: string | null;
}>;

export type AppRuntime = Readonly<{
  database: AppDatabase;
  runner: ForegroundJobRunner;
  deletion: DataDeletionPort;
  handlers: readonly JobHandler[];
  refresh: () => Promise<AppRuntimeSnapshot>;
  wake: () => void;
  notifyCaptureSaved: () => void;
  notifyCredentialsChanged: () => void;
}>;

const initialSnapshot: AppRuntimeSnapshot = {
  status: "idle",
  onboardingComplete: false,
  preferences: null,
  error: null,
};

let snapshot = initialSnapshot;
let runtime: AppRuntime | null = null;
let bootPromise: Promise<AppRuntime> | null = null;
const listeners = new Set<(next: AppRuntimeSnapshot) => void>();
function publish(next: AppRuntimeSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}
function requireAndroid() {
  if (Platform.OS !== "android") {
    throw domainError(
      "unsupported",
      "database",
      "Hmmmidea is available on Android only.",
    );
  }
}
async function setupSnapshot(
  database: AppDatabase,
): Promise<AppRuntimeSnapshot> {
  const preferences = await database.repositories.preferences.get();
  const [speech, ai] = await Promise.all([
    providerCredentials.readActive("speech"),
    providerCredentials.readActive("ai"),
  ]);
  const onboardingComplete = Boolean(
    preferences.onboardingComplete &&
    preferences.speechProvider.model.trim() &&
    preferences.aiProvider.model.trim() &&
    speech?.secret.trim() &&
    ai?.secret.trim(),
  );
  return { status: "ready", onboardingComplete, preferences, error: null };
}
function createDeletion(database: AppDatabase): LocalDataDeletion {
  return new LocalDataDeletion({
    deletions: database.repositories.deletions,
    cleanup: database.repositories.cleanup,
    secrets: providerCredentials,
    audioFiles: new AppOwnedAudioFiles(),
    isAppOwnedUri: isAppOwnedAudioUri,
  });
}
function runtimeProcessingDependencies(
  database: AppDatabase,
): ProcessingHandlerDependencies {
  return {
    repositories: database.repositories,
    providers: providerRegistry,
    secrets: providerCredentials,
    // This port publishes in-app feedback while active and schedules only when backgrounded.
    notifications: androidNotificationPort,
  };
}
export function createRuntimeJobHandlers(database: AppDatabase) {
  const dependencies = runtimeProcessingDependencies(database);
  return [
    createTranscriptionHandler(dependencies),
    createReportHandler(dependencies),
  ] as const;
}
async function hydrate(): Promise<AppRuntime> {
  requireAndroid();
  // Legacy setup migration runs before the shared handle is opened.
  const preferences = await readPreferences();
  await cancelPendingGenericNotifications(preferences.notifications);
  const database = await openAppDatabase();
  let runner: ForegroundJobRunner | null = null;
  let unsubscribeDatabase: (() => void) | null = null;
  let appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  try {
    const deletion = createDeletion(database);
    await deletion.resume();
    await reconcileExportArtifacts();

    const handlers = createRuntimeJobHandlers(database);
    const activeRunner = new ForegroundJobRunner({
      repository: database.repositories.jobs,
      handlers,
      subscriptions: database.subscriptions,
      onTerminalFailure: createTerminalFailureHandler({
        repositories: database.repositories,
        providers: providerRegistry,
        secrets: providerCredentials,
        notifications: androidNotificationPort,
      }),
    });
    runner = activeRunner;
    const refresh = async () => {
      const next = await setupSnapshot(database);
      publish(next);
      return next;
    };
    const wake = () => activeRunner.wake();
    const appRuntime: AppRuntime = {
      database,
      runner: activeRunner,
      deletion,
      handlers,
      refresh,
      wake,
      notifyCaptureSaved: wake,
      notifyCredentialsChanged: wake,
    };

    unsubscribeDatabase = database.subscriptions.subscribe((change) => {
      if (change.table === "captures" || change.table === "jobs") wake();
      if (change.table === "preferences") {
        wake();
        void refresh().catch(() => undefined);
      }
    });
    appStateSubscription = AppState.addEventListener("change", () => {
      wake();
      void refresh().catch(() => undefined);
    });
    await refresh();
    activeRunner.start();
    runtime = appRuntime;
    return appRuntime;
  } catch (error) {
    unsubscribeDatabase?.();
    appStateSubscription?.remove();
    await runner?.stop().catch(() => undefined);
    await database.close().catch(() => undefined);
    throw error;
  }
}
export function getAppRuntimeSnapshot() {
  return snapshot;
}
export function getAppRuntime() {
  return runtime;
}
export function subscribeAppRuntime(
  listener: (next: AppRuntimeSnapshot) => void,
) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}
export async function bootAppRuntime() {
  if (runtime) return runtime;
  if (bootPromise) return bootPromise;
  publish({ ...snapshot, status: "hydrating", error: null });
  bootPromise = hydrate().catch((error) => {
    const detail = normalizeError(error, "database");
    publish({ ...snapshot, status: "error", error: detail.message });
    bootPromise = null;
    throw error;
  });
  return bootPromise;
}
export function retryAppRuntime() {
  return bootAppRuntime();
}
export async function refreshAppRuntime() {
  try {
    const appRuntime = await bootAppRuntime();
    return await appRuntime.refresh();
  } catch (error) {
    const detail = normalizeError(error, "database");
    publish({ ...snapshot, status: "error", error: detail.message });
    throw error;
  }
}
export function useAppRuntime() {
  const [current, setCurrent] = useState(snapshot);
  useEffect(() => {
    const unsubscribe = subscribeAppRuntime(setCurrent);
    void bootAppRuntime().catch(() => undefined);
    return () => {
      unsubscribe();
    };
  }, []);
  return current;
}
export async function notifyCaptureSaved() {
  (await bootAppRuntime()).notifyCaptureSaved();
}
export async function notifyProviderCredentialsChanged() {
  (await bootAppRuntime()).notifyCredentialsChanged();
}

/** Shared provider/storage dependency for the capture controller consolidation. */
export async function getRuntimeProcessingDependencies() {
  const appRuntime = await bootAppRuntime();
  return runtimeProcessingDependencies(appRuntime.database);
}

/** Retries the latest failed durable job without creating a duplicate capture. */
export async function retryCaptureProcessing(captureId: string) {
  const appRuntime = await bootAppRuntime();
  const generation =
    await appRuntime.database.repositories.deletions.getGeneration();
  const capture =
    await appRuntime.database.repositories.captures.get(captureId);
  if (!capture || capture.status !== "failed") return false;
  if (capture.generation !== generation) return false;
  const preferences = await appRuntime.database.repositories.preferences.get();
  const jobs =
    await appRuntime.database.repositories.jobs.listForCapture(captureId);
  const failed = [...jobs]
    .filter((job) => job.status === "failed")
    .sort((left, right) => right.revision - left.revision)[0];
  const now = new Date().toISOString();
  const revision = Math.max(0, ...jobs.map((job) => job.revision)) + 1;

  const retryJob =
    !failed || failed.kind === "transcribe-capture"
      ? capture.audio
        ? transcriptionJob({
            captureId,
            generation,
            revision,
            requestId: failed
              ? `${failed.requestId}:retry`
              : `${captureId}:recovery:transcription`,
            audio: capture.audio,
            expectedTranscriptRevision: capture.transcript?.revision ?? 0,
            runAfter: now,
            maxAttempts: JOB_RUNTIME.maxAttempts,
          })
        : null
      : failed.kind === "generate-report" &&
          capture.transcript?.phase === "final"
        ? reportJob({
            captureId,
            generation,
            revision,
            requestId: `${failed.requestId}:retry`,
            transcriptRevision: capture.transcript.revision,
            expectedActiveRevision: capture.activeReportRevision,
            researchEnabled: preferences.researchEnabled,
            reason: "explicit-regenerate",
            explicitlyReplacedUserFields: [],
            runAfter: now,
            maxAttempts: JOB_RUNTIME.maxAttempts,
          })
        : null;
  if (!retryJob) return false;
  await appRuntime.database.repositories.jobs.enqueue(retryJob);
  await appRuntime.database.repositories.captures.setProcessingState(
    captureId,
    "queued",
    null,
    now,
    generation,
  );
  appRuntime.wake();
  return true;
}
