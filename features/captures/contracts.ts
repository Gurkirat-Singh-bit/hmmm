import type { CaptureRecord } from '../domain/contracts';

export type CapturePhase =
  | 'idle'
  | 'permission'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'saving'
  | 'queued'
  | 'failure';

export type CapturePresentation = Readonly<{
  phase: CapturePhase;
  elapsedMs: number;
  transcript: string;
  transcriptMode: 'live' | 'after-saving';
  message: string | null;
  canRetry: boolean;
}>;

export type CaptureHomeState = Readonly<{
  capture: CapturePresentation;
  recent: readonly CaptureRecord[];
}>;
