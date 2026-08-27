import type { RecordingEvent, RecordingSessionPort } from '../domain/contracts';
import type { FinalTranscript, LiveTranscriptEvent, LiveTranscriptionSessionPort } from '../domain/providers';
import { LIVE_TRANSCRIPTION } from './constants';

type QueuedChunk = Readonly<{ data: Uint8Array; sequence: number }>;

export type LiveSessionFactory = () => Promise<LiveTranscriptionSessionPort>;

/**
 * Keeps provider streaming disposable. Local recording owns the source file and
 * never waits for, pauses for, or fails with the live connection.
 */
export class RecordingLiveTranscription {
  private readonly listeners = new Set<(event: LiveTranscriptEvent) => void>();
  private readonly pending: QueuedChunk[] = [];
  private readonly seenKeys = new Set<string>();
  private readonly seenOrder: string[] = [];
  private recordingUnsubscribe: (() => void) | null = null;
  private liveUnsubscribe: (() => void) | null = null;
  private live: LiveTranscriptionSessionPort | null = null;
  private opening: Promise<LiveTranscriptionSessionPort | null> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private draining = false;
  private active = false;
  private recording = false;
  private connectionGeneration = 0;
  private firstFinalAfterReconnect = false;
  private outputSequence = 0;
  private lastProvisional = '';
  private lastFinal = '';
  private closedPublished = false;
  private finalResult: Promise<FinalTranscript | null> | null = null;

  constructor(
    private readonly source: RecordingSessionPort,
    private readonly openSession: LiveSessionFactory,
    private readonly maxPendingChunks = LIVE_TRANSCRIPTION.maxPendingChunks,
  ) {
    if (!Number.isInteger(maxPendingChunks) || maxPendingChunks < 1) {
      throw new Error('maxPendingChunks must be a positive integer.');
    }
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.recording = this.source.getState() === 'recording';
    this.recordingUnsubscribe = this.source.subscribe((event) => this.onRecordingEvent(event));
    if (this.recording) void this.ensureLiveSession().then(() => this.drain());
  }

  subscribe(listener: (event: LiveTranscriptEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async finish(): Promise<FinalTranscript | null> {
    if (this.finalResult) return this.finalResult;
    this.finalResult = this.finishLive();
    return this.finalResult;
  }

  private async finishLive(): Promise<FinalTranscript | null> {
    this.active = false;
    this.recording = false;
    this.stopReconnect();
    this.recordingUnsubscribe?.();
    this.recordingUnsubscribe = null;
    if (!(await this.waitForDrain())) {
      const stalled = this.live;
      this.detachLive();
      this.pending.length = 0;
      if (stalled) await this.cancelQuietly(stalled);
      this.listeners.clear();
      return null;
    }

    const live = this.live;
    this.detachLive();
    this.pending.length = 0;
    if (!live) {
      this.listeners.clear();
      return null;
    }
    try {
      return await live.finish();
    } catch {
      await this.cancelQuietly(live);
      return null;
    } finally {
      this.listeners.clear();
    }
  }

  async cancel(): Promise<void> {
    this.active = false;
    this.recording = false;
    this.stopReconnect();
    this.recordingUnsubscribe?.();
    this.recordingUnsubscribe = null;
    this.pending.length = 0;
    const live = this.live;
    this.detachLive();
    if (live) await this.cancelQuietly(live);
    this.listeners.clear();
  }

  private onRecordingEvent(event: RecordingEvent): void {
    if (!this.active) return;
    if (event.type === 'audio-chunk') {
      if (!this.recording) return;
      this.pending.push({ data: event.data, sequence: event.sequence });
      while (this.pending.length > this.maxPendingChunks) this.pending.shift();
      void this.drain();
      return;
    }
    if (event.type !== 'state') return;

    this.recording = event.state === 'recording';
    if (event.state === 'paused') {
      this.pending.length = 0;
      void this.closeLiveSession();
    } else if (event.state === 'recording') {
      void this.ensureLiveSession().then(() => this.drain());
    } else if (event.state === 'stopping') {
      this.stopReconnect();
      this.pending.length = 0;
    } else if (event.state === 'stopped') {
      void this.finish();
    } else if (event.state === 'failed') {
      this.pending.length = 0;
      void this.cancel();
    }
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.active || !this.recording) return;
    this.draining = true;
    try {
      while (this.active && this.recording && this.pending.length > 0) {
        const live = await this.ensureLiveSession();
        if (!live) return;
        const chunk = this.pending.shift();
        if (!chunk) return;
        if (!(await this.send(live, chunk))) {
          this.dropFailedLive(live);
          this.publishClosed();
          this.scheduleReconnect();
          return;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async ensureLiveSession(): Promise<LiveTranscriptionSessionPort | null> {
    if (!this.active || !this.recording) return null;
    if (this.live) return this.live;
    if (this.opening) return this.opening;

    this.opening = (async () => {
      try {
        const candidate = this.openSession();
        const live = await Promise.race([
          candidate,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), LIVE_TRANSCRIPTION.openTimeoutMs)),
        ]);
        if (!live) {
          void candidate.then((late) => this.cancelQuietly(late), () => undefined);
          this.publishClosed();
          this.scheduleReconnect();
          return null;
        }
        if (!this.active || !this.recording) {
          await this.cancelQuietly(live);
          return null;
        }
        this.live = live;
        this.connectionGeneration += 1;
        this.firstFinalAfterReconnect = this.connectionGeneration > 1;
        const unsubscribe = live.subscribe((event) => this.onLiveEvent(live, event));
        if (this.live === live) this.liveUnsubscribe = unsubscribe;
        else unsubscribe();
        return this.live;
      } catch {
        this.publishClosed();
        this.scheduleReconnect();
        return null;
      } finally {
        this.opening = null;
      }
    })();
    return this.opening;
  }

  private onLiveEvent(owner: LiveTranscriptionSessionPort, event: LiveTranscriptEvent): void {
    if (owner !== this.live) return;
    if (event.type === 'closed') {
      this.detachLive();
      this.publishClosed();
      this.scheduleReconnect();
      return;
    }

    const text = event.text.trim();
    if (!text) return;
    this.closedPublished = false;
    const key = `${this.connectionGeneration}:${event.phase}:${event.sequence}:${text}`;
    const reconnectDuplicate =
      event.phase === 'final' && this.firstFinalAfterReconnect && text === this.lastFinal;
    if (event.phase === 'final') this.firstFinalAfterReconnect = false;
    if (this.seenKeys.has(key) || reconnectDuplicate || (event.phase === 'provisional' && text === this.lastProvisional)) return;
    this.remember(key);
    if (event.phase === 'provisional') this.lastProvisional = text;
    else {
      this.lastProvisional = '';
      this.lastFinal = text;
    }

    const ordered: LiveTranscriptEvent = {
      type: 'transcript',
      phase: event.phase,
      text,
      sequence: this.outputSequence,
    };
    this.outputSequence += 1;
    for (const listener of this.listeners) {
      try {
        listener(ordered);
      } catch {
        // Transcript presentation cannot affect recording or socket ordering.
      }
    }
  }

  private remember(key: string): void {
    this.seenKeys.add(key);
    this.seenOrder.push(key);
    if (this.seenOrder.length <= LIVE_TRANSCRIPTION.transcriptDedupeWindow) return;
    const expired = this.seenOrder.shift();
    if (expired) this.seenKeys.delete(expired);
  }

  private publishClosed(): void {
    if (this.closedPublished) return;
    this.closedPublished = true;
    for (const listener of this.listeners) {
      try {
        listener({ type: 'closed' });
      } catch {
        // Presentation listener errors cannot affect reconnection.
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.active || !this.recording || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureLiveSession().then(() => this.drain());
    }, LIVE_TRANSCRIPTION.reconnectDelayMs);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async closeLiveSession(): Promise<void> {
    this.stopReconnect();
    const live = this.live;
    this.detachLive();
    if (live) await this.cancelQuietly(live);
  }

  private dropFailedLive(live: LiveTranscriptionSessionPort): void {
    if (this.live === live) this.detachLive();
    void this.cancelQuietly(live);
  }

  private send(live: LiveTranscriptionSessionPort, chunk: QueuedChunk): Promise<boolean> {
    return Promise.race([
      live.sendAudio(chunk.data, chunk.sequence).then(
        () => true,
        () => false,
      ),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), LIVE_TRANSCRIPTION.sendTimeoutMs)),
    ]);
  }

  private detachLive(): void {
    this.liveUnsubscribe?.();
    this.liveUnsubscribe = null;
    this.live = null;
  }

  private async cancelQuietly(live: LiveTranscriptionSessionPort): Promise<void> {
    try {
      await live.cancel();
    } catch {
      // Live cleanup cannot affect the durable local recording.
    }
  }

  private async waitForDrain(): Promise<boolean> {
    if (!this.draining) return true;
    return Promise.race([
      (async () => {
        while (this.draining) await new Promise<void>((resolve) => setTimeout(resolve, 25));
        return true;
      })(),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), LIVE_TRANSCRIPTION.finishDrainTimeoutMs)),
    ]);
  }
}
