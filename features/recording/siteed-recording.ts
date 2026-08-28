import { AppState, Platform, type AppStateStatus } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import type {
  AudioAsset,
  NormalizedError,
  RecordingEvent,
  RecordingPermission,
  RecordingPort,
  RecordingSessionPort,
  RecordingSessionState,
} from '../domain/contracts';
import { DomainError, domainError, normalizeError } from '../domain/errors';
import { RECORDING_AUDIO } from './constants';
import { recordingDraftDirectory, recordingDraftFile, validateAudioAsset } from './audio-storage';

type Subscription = Readonly<{ remove(): void }>;

type PermissionResponse = Readonly<{
  status?: string;
  granted?: boolean;
}>;

type SiteedStartResult = Readonly<{
  fileUri: string;
  mimeType: string;
  channels?: number;
  bitDepth?: number;
  sampleRate?: number;
}>;

type SiteedRecordingResult = Readonly<{
  fileUri: string;
  filename: string;
  durationMs: number;
  size: number;
  mimeType: string;
  channels: number;
  bitDepth: number;
  sampleRate: number;
}>;

type SiteedAudioEvent = Readonly<{
  pcmFloat32?: Float32Array | readonly number[];
  deltaSize: number;
}>;

type SiteedInterruptionEvent = Readonly<{
  reason: string;
  isPaused: boolean;
}>;

type SiteedStatus = Readonly<{
  isRecording: boolean;
  isPaused: boolean;
  durationMs?: number;
}>;

type SiteedModule = Readonly<{
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  startRecording(options: Readonly<Record<string, unknown>>): Promise<SiteedStartResult>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  stopRecording(): Promise<SiteedRecordingResult>;
  status(): SiteedStatus;
  addListener(eventName: string, listener: (event: never) => void): Subscription;
}>;

function permission(response: PermissionResponse): RecordingPermission {
  if (response.granted || response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  return 'undetermined';
}

function requireAndroid(): void {
  if (Platform.OS !== 'android') {
    throw domainError('unsupported', 'recording', 'Recording is supported on Android only.');
  }
}

async function loadSiteed(): Promise<SiteedModule> {
  requireAndroid();
  if (!requireOptionalNativeModule('AudioStudio')) {
    throw domainError('unsupported', 'recording', 'Recording requires the installed Android development build, not Expo Go.');
  }
  try {
    const library = await import('@siteed/audio-studio');
    return library.AudioStudioModule as SiteedModule;
  } catch {
    throw domainError('unsupported', 'recording', 'Recording requires an Android native development build.');
  }
}

function interruptionError(message: string): NormalizedError {
  return {
    code: 'recording-interrupted',
    operation: 'recording',
    message,
    retryable: true,
    occurredAt: new Date().toISOString(),
    providerId: null,
    statusCode: null,
  };
}

function float32ToPcm16(samples: Float32Array | readonly number[]): Uint8Array {
  const pcm = new Uint8Array(samples.length * 2);
  const view = new DataView(pcm.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return pcm;
}

function container(mimeType: string, fileUri: string): string {
  const extension = fileUri.match(/\.([A-Za-z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase();
  if (extension) return extension;
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  return mimeType.split('/')[1]?.split(';')[0] || 'audio';
}

function localPath(uri: string): string {
  return decodeURIComponent(uri).replace(/^file:\/+/u, '/');
}

class SiteedRecordingSession implements RecordingSessionPort {
  readonly id: string;

  private state: RecordingSessionState = 'starting';
  private readonly listeners = new Set<(event: RecordingEvent) => void>();
  private readonly nativeSubscriptions: Subscription[] = [];
  private appStateSubscription: Subscription | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private lastDurationMs = 0;
  private appPausePending = false;
  private finalAsset: AudioAsset | null = null;
  private finalizing: Promise<AudioAsset> | null = null;
  private startResult: SiteedStartResult | null = null;
  private transitionQueue: Promise<unknown> = Promise.resolve();
  private transitionEpoch = 0;
  private cleanedUp = false;

  constructor(
    private readonly native: SiteedModule,
    id: string,
    private readonly recoveryId: string,
    private readonly onTerminal: () => void,
  ) {
    this.id = id;
  }

  async start(): Promise<void> {
    const draft = recordingDraftFile(this.recoveryId);
    if (draft.exists) {
      throw domainError('conflict', 'recording', 'A recording draft already exists at this recovery path.');
    }

    this.nativeSubscriptions.push(
      this.native.addListener('AudioData', ((event: SiteedAudioEvent) => this.onAudioData(event)) as (event: never) => void),
      this.native.addListener(
        'onRecordingInterrupted',
        ((event: SiteedInterruptionEvent) => this.onInterrupted(event)) as (event: never) => void,
      ),
      this.native.addListener('MaxDurationReached', (() => void this.autoFinish()) as (event: never) => void),
    );
    this.appStateSubscription = AppState.addEventListener('change', (next) => void this.onAppState(next));

    try {
      this.startResult = await this.native.startRecording({
        sampleRate: RECORDING_AUDIO.sampleRateHz,
        channels: RECORDING_AUDIO.channelCount,
        encoding: `pcm_${RECORDING_AUDIO.bitDepth}bit`,
        interval: RECORDING_AUDIO.chunkIntervalMs,
        keepAwake: false,
        showNotification: false,
        enableProcessing: false,
        keepFullAnalysis: false,
        output: { primary: { enabled: true, format: 'wav' }, compressed: { enabled: false } },
        autoResumeAfterInterruption: false,
        maxDurationMs: RECORDING_AUDIO.maxActiveDurationMs,
        autoStopOnMaxDuration: false,
        outputDirectory: recordingDraftDirectory().uri,
        filename: this.recoveryId,
        streamFormat: 'float32',
        android: { audioFocusStrategy: 'interactive' },
      });
      this.setState('recording');
      this.durationTimer = setInterval(() => this.updateDuration(), RECORDING_AUDIO.durationUpdateMs);
    } catch (error) {
      this.fail(error);
      throw this.asDomainError(error);
    }
  }

  getState(): RecordingSessionState {
    return this.state;
  }

  subscribe(listener: (event: RecordingEvent) => void): () => void {
    listener({ type: 'state', state: this.state });
    listener({ type: 'duration', durationMs: this.lastDurationMs });
    if (this.state === 'stopped' || this.state === 'failed') return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async pause(): Promise<void> {
    return this.enqueueTransition(async (epoch) => {
      if (this.state === 'paused') return;
      if (this.state !== 'recording') {
        throw domainError('conflict', 'recording', 'Only an active recording can be paused.');
      }
      try {
        await this.native.pauseRecording();
        if (!this.isTransitionCurrent(epoch, 'recording')) return;
        this.setState('paused');
      } catch (error) {
        if (!this.isTransitionCurrent(epoch, 'recording')) return;
        try {
          if (this.native.status().isPaused && this.isTransitionCurrent(epoch, 'recording')) {
            this.setState('paused');
            return;
          }
        } catch {
          // Preserve the original pause failure below.
        }
        if (this.isTransitionCurrent(epoch, 'recording')) throw this.asDomainError(error);
      }
    });
  }

  async resume(): Promise<void> {
    return this.enqueueTransition(async (epoch) => {
      if (this.state === 'recording') return;
      if (this.state !== 'paused') {
        throw domainError('conflict', 'recording', 'Only a paused recording can be resumed.');
      }
      if (AppState.currentState !== 'active') {
        throw domainError('recording-interrupted', 'recording', 'Return to the app before resuming the recording.', true);
      }
      try {
        await this.native.resumeRecording();
        if (!this.isTransitionCurrent(epoch, 'paused')) return;
        this.setState('recording');
      } catch (error) {
        if (this.isTransitionCurrent(epoch, 'paused')) throw this.asDomainError(error);
      }
    });
  }

  async finish(): Promise<AudioAsset> {
    if (this.finalAsset) return this.finalAsset;
    if (this.finalizing) return this.finalizing;
    const finalizing = this.enqueueTransition(async (epoch) => {
      if (this.finalAsset) return this.finalAsset;
      if (this.state !== 'recording' && this.state !== 'paused') {
        throw domainError('conflict', 'recording', 'The recording cannot be finalized from its current state.');
      }

      this.setState('stopping');
      try {
        const asset = await this.stopAndCreateAsset(epoch);
        if (!this.isTransitionCurrent(epoch, 'stopping')) throw this.staleTransitionError();
        this.finalAsset = asset;
        if (this.lastDurationMs !== asset.durationMs) {
          this.lastDurationMs = asset.durationMs;
          this.emit({ type: 'duration', durationMs: this.lastDurationMs });
        }
        this.setState('stopped');
        this.cleanup();
        return asset;
      } catch (error) {
        const domain = this.asDomainError(error);
        if (!this.isTransitionCurrent(epoch, 'stopping')) throw domain;
        try {
          const status = this.native.status();
          if (status.isRecording || status.isPaused) await this.native.pauseRecording();
        } catch {
          // The draft remains in app-owned storage even if native shutdown failed.
        }
        if (!this.isTransitionCurrent(epoch, 'stopping')) throw domain;
        this.fail(domain);
        throw domain;
      }
    });
    this.finalizing = finalizing;
    void finalizing.then(
      () => { if (this.finalizing === finalizing) this.finalizing = null; },
      () => { if (this.finalizing === finalizing) this.finalizing = null; },
    );
    return finalizing;
  }

  async cancel(): Promise<void> {
    return this.enqueueTransition(async (epoch) => {
      if (this.state === 'stopped') return;
      const wasFailed = this.state === 'failed';
      if (!wasFailed && (this.state === 'recording' || this.state === 'paused')) this.setState('stopping');
      const expectedState: RecordingSessionState = wasFailed ? 'failed' : 'stopping';
      try {
        const status = this.native.status();
        if (status.isRecording || status.isPaused) {
          if (!this.isTransitionCurrent(epoch, expectedState)) return;
          await this.native.stopRecording();
          if (!this.isTransitionCurrent(epoch, expectedState)) return;
        }
      } catch (error) {
        if (!this.isTransitionCurrent(epoch, expectedState)) return;
        this.fail(error);
        throw this.asDomainError(error);
      }

      if (!this.isTransitionCurrent(epoch, expectedState)) return;
      const file = recordingDraftFile(this.recoveryId);
      if (file.exists) file.delete();
      if (!this.isTransitionCurrent(epoch, expectedState)) return;
      this.setState('stopped');
      this.cleanup();
    });
  }

  private onAudioData(event: SiteedAudioEvent): void {
    if (this.state !== 'recording' || event.deltaSize <= 0 || event.pcmFloat32 == null) return;
    const data = float32ToPcm16(event.pcmFloat32);
    if (data.byteLength === 0) return;
    this.emit({
      type: 'audio-chunk',
      data,
      sequence: this.sequence,
      mimeType: RECORDING_AUDIO.streamMimeType,
    });
    this.sequence += 1;
  }

  private onInterrupted(event: SiteedInterruptionEvent): void {
    if (this.state !== 'recording' && this.state !== 'paused') return;
    if (event.isPaused) {
      const newlyPaused = this.state !== 'paused';
      this.setState('paused');
      if (newlyPaused) {
        this.emit({ type: 'interrupted', error: interruptionError('Recording was paused by an audio interruption. Tap Resume when ready.') });
      }
    } else if (event.reason === 'recordingStopped') {
      this.fail(new DomainError(interruptionError('Recording was stopped by the system. Your draft audio was preserved.')));
    }
  }

  private async onAppState(next: AppStateStatus): Promise<void> {
    if (next === 'active' || this.state !== 'recording' || this.appPausePending) return;
    this.appPausePending = true;
    try {
      await this.enqueueTransition(async (epoch) => {
        if (!this.isTransitionCurrent(epoch, 'recording')) return;
        try {
          await this.native.pauseRecording();
          if (!this.isTransitionCurrent(epoch, 'recording')) return;
          this.setState('paused');
          this.emit({
            type: 'interrupted',
            error: interruptionError('Recording paused when the app became inactive. Tap Resume to continue.'),
          });
        } catch (error) {
          if (!this.isTransitionCurrent(epoch, 'recording')) return;
          try {
            if (this.native.status().isPaused && this.isTransitionCurrent(epoch, 'recording')) {
              this.setState('paused');
              this.emit({
                type: 'interrupted',
                error: interruptionError('Recording paused when the app became inactive. Tap Resume to continue.'),
              });
              return;
            }
          } catch {
            // Fall through to a safe failed state.
          }
          if (this.isTransitionCurrent(epoch, 'recording')) this.fail(error);
        }
      });
    } finally {
      this.appPausePending = false;
    }
  }

  private updateDuration(): void {
    if (this.state !== 'recording' && this.state !== 'paused') return;
    try {
      const status = this.native.status();
      const durationMs = Math.min(status.durationMs ?? this.lastDurationMs, RECORDING_AUDIO.maxActiveDurationMs);
      if (durationMs !== this.lastDurationMs) {
        this.lastDurationMs = durationMs;
        this.emit({ type: 'duration', durationMs });
      }
      if (durationMs >= RECORDING_AUDIO.maxActiveDurationMs && this.state === 'recording') void this.autoFinish();
    } catch {
      // A transient status read must not interrupt the native recording.
    }
  }

  private async autoFinish(): Promise<void> {
    if (this.finalAsset || this.finalizing || (this.state !== 'recording' && this.state !== 'paused')) return;
    try {
      await this.finish();
    } catch {
      // finish() already publishes the safe interruption error and preserves the draft file.
    }
  }

  private async stopAndCreateAsset(epoch: number): Promise<AudioAsset> {
    const result = await this.native.stopRecording();
    if (!this.isTransitionCurrent(epoch, 'stopping')) throw this.staleTransitionError();
    const file = recordingDraftFile(this.recoveryId);
    if (!file.exists || localPath(result.fileUri) !== localPath(file.uri)) {
      throw domainError('storage-failed', 'recording', 'The recorder returned an unexpected audio path.');
    }
    const sampleRateHz = result.sampleRate || this.startResult?.sampleRate || 0;
    const channelCount = result.channels || this.startResult?.channels || 0;
    const bitDepth = result.bitDepth || this.startResult?.bitDepth || 0;
    return validateAudioAsset({
      uri: file.uri,
      container: container(result.mimeType, result.fileUri),
      mimeType: result.mimeType,
      sampleRateHz,
      channelCount,
      bitRateBps: sampleRateHz * channelCount * bitDepth,
      durationMs: result.durationMs,
      byteLength: file.size,
    });
  }

  private setState(state: RecordingSessionState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: 'state', state });
  }

  private emit(event: RecordingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A presentation listener cannot interrupt the native recording.
      }
    }
  }

  private fail(error: unknown): void {
    if (this.state === 'failed' || this.state === 'stopped') return;
    const normalized = normalizeError(error, 'recording');
    const safeError = normalized.code === 'unknown' ? interruptionError('Recording stopped unexpectedly. Your draft audio was preserved.') : normalized;
    this.transitionEpoch += 1;
    this.setState('failed');
    this.emit({ type: 'interrupted', error: safeError });
    this.cleanup();
  }

  private asDomainError(error: unknown): DomainError {
    if (error instanceof DomainError) return error;
    const normalized = normalizeError(error, 'recording');
    return new DomainError(normalized);
  }

  private staleTransitionError(): DomainError {
    return domainError('recording-interrupted', 'recording', 'The recording changed before the native transition completed.', true);
  }

  private isTransitionCurrent(epoch: number, expectedState?: RecordingSessionState): boolean {
    return this.transitionEpoch === epoch && (expectedState == null || this.state === expectedState);
  }

  private enqueueTransition<T>(task: (epoch: number) => Promise<T>): Promise<T> {
    const next = this.transitionQueue.then(
      () => task(++this.transitionEpoch),
      () => task(++this.transitionEpoch),
    );
    this.transitionQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    if (this.durationTimer) clearInterval(this.durationTimer);
    this.durationTimer = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    for (const subscription of this.nativeSubscriptions.splice(0)) subscription.remove();
    this.listeners.clear();
    this.onTerminal();
  }
}

export class SiteedRecordingAdapter implements RecordingPort {
  private activeSession: SiteedRecordingSession | null = null;

  async getPermission(): Promise<RecordingPermission> {
    const native = await loadSiteed();
    return permission(await native.getPermissionsAsync());
  }

  async requestPermission(): Promise<RecordingPermission> {
    const native = await loadSiteed();
    return permission(await native.requestPermissionsAsync());
  }

  async start(
    input: Readonly<{ draftId: string; captureId: string; recoveryId: string }>,
  ): Promise<RecordingSessionPort> {
    if (this.activeSession && !['stopped', 'failed'].includes(this.activeSession.getState())) {
      throw domainError('conflict', 'recording', 'Another recording is already active.');
    }

    const native = await loadSiteed();
    if (permission(await native.getPermissionsAsync()) !== 'granted') {
      throw domainError('permission-denied', 'recording', 'Microphone permission is required to record.');
    }

    // The persisted recovery ID is the app-owned filename; validate it before native recording starts.
    recordingDraftFile(input.recoveryId);
    const session = new SiteedRecordingSession(native, input.draftId, input.recoveryId, () => {
      if (this.activeSession === session) this.activeSession = null;
    });
    this.activeSession = session;
    try {
      await session.start();
      return session;
    } catch (error) {
      if (this.activeSession === session) this.activeSession = null;
      throw error;
    }
  }
}
