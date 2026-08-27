import { Platform } from 'react-native';

import type {
  AudioAsset,
  PlaybackEvent,
  PlaybackPort,
  PlaybackSessionPort,
  PlaybackState,
} from '../domain/contracts';
import { DomainError, domainError, normalizeError } from '../domain/errors';
import { PLAYBACK_UPDATE_INTERVAL_MS } from './constants';
import { validateAudioAsset } from './audio-storage';

type Subscription = Readonly<{ remove(): void }>;

type PlayerStatus = Readonly<{
  currentTime: number;
  duration: number;
  playing: boolean;
  didJustFinish: boolean;
  isLoaded: boolean;
}>;

type AudioPlayer = Readonly<{
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
  addListener(eventName: 'playbackStatusUpdate', listener: (status: PlayerStatus) => void): Subscription;
}>;

function playbackError(error: unknown, fallback: string): DomainError {
  if (error instanceof DomainError) return error;
  const normalized = normalizeError(error, 'recording');
  return domainError(
    normalized.code,
    normalized.operation,
    normalized.code === 'unknown' ? fallback : normalized.message,
    normalized.retryable,
    normalized.occurredAt,
  );
}

class ExpoPlaybackSession implements PlaybackSessionPort {
  private state: PlaybackState = 'loading';
  private readonly listeners = new Set<(event: PlaybackEvent) => void>();
  private readonly statusSubscription: Subscription;
  private disposed = false;
  private durationMs: number;

  constructor(
    private readonly player: AudioPlayer,
    durationMs: number,
  ) {
    this.durationMs = durationMs;
    this.statusSubscription = player.addListener('playbackStatusUpdate', (status) => this.onStatus(status));
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener);
    listener({ type: 'state', state: this.state });
    return () => this.listeners.delete(listener);
  }

  async play(): Promise<void> {
    this.requireActive();
    try {
      this.player.play();
      this.setState('playing');
    } catch (error) {
      throw this.fail(error, 'Source audio could not be played.');
    }
  }

  async pause(): Promise<void> {
    this.requireActive();
    try {
      this.player.pause();
      this.setState('paused');
    } catch (error) {
      throw this.fail(error, 'Source audio could not be paused.');
    }
  }

  async seek(positionMs: number): Promise<void> {
    this.requireActive();
    if (!Number.isFinite(positionMs)) {
      throw domainError('unsupported', 'recording', 'Playback position must be a finite number.');
    }
    const targetMs = Math.max(0, Math.min(positionMs, this.durationMs));
    try {
      await this.player.seekTo(targetMs / 1_000);
      this.emit({ type: 'position', positionMs: targetMs, durationMs: this.durationMs });
      if (this.state === 'ended' && targetMs < this.durationMs) this.setState('paused');
    } catch (error) {
      throw this.fail(error, 'Source audio could not seek to that position.');
    }
  }

  async stop(): Promise<void> {
    this.requireActive();
    try {
      this.player.pause();
      await this.player.seekTo(0);
      this.setState('idle');
      this.emit({ type: 'position', positionMs: 0, durationMs: this.durationMs });
    } catch (error) {
      throw this.fail(error, 'Source audio could not be stopped.');
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.statusSubscription.remove();
    this.player.remove();
    this.listeners.clear();
  }

  private onStatus(status: PlayerStatus): void {
    if (this.disposed) return;
    if (status.duration > 0) this.durationMs = Math.round(status.duration * 1_000);
    this.emit({
      type: 'position',
      positionMs: Math.max(0, Math.round(status.currentTime * 1_000)),
      durationMs: this.durationMs,
    });
    if (status.didJustFinish) this.setState('ended');
    else if (status.playing) this.setState('playing');
    else if (status.isLoaded && this.state === 'loading') this.setState('idle');
  }

  private requireActive(): void {
    if (this.disposed) throw domainError('conflict', 'recording', 'The playback session has already been unloaded.');
  }

  private fail(error: unknown, fallback: string): DomainError {
    const failure = playbackError(error, fallback);
    this.setState('failed');
    this.emit({ type: 'error', error: failure.detail });
    return failure;
  }

  private setState(state: PlaybackState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: 'state', state });
  }

  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Presentation listener errors must not leak the native player.
      }
    }
  }
}

export class ExpoAudioPlaybackAdapter implements PlaybackPort {
  async open(audio: AudioAsset): Promise<PlaybackSessionPort> {
    if (Platform.OS !== 'android') {
      throw domainError('unsupported', 'recording', 'Source audio playback is supported on Android only.');
    }
    validateAudioAsset(audio);

    try {
      const { createAudioPlayer } = await import('expo-audio');
      const player = createAudioPlayer({ uri: audio.uri }, { updateInterval: PLAYBACK_UPDATE_INTERVAL_MS });
      return new ExpoPlaybackSession(player as AudioPlayer, audio.durationMs);
    } catch (error) {
      throw playbackError(error, 'Source audio could not be loaded.');
    }
  }
}
