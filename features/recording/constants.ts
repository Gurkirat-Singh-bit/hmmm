export const RECORDING_AUDIO = {
  sampleRateHz: 16_000,
  channelCount: 1,
  bitDepth: 16,
  streamMimeType: 'audio/pcm;encoding=signed-integer;bits=16;rate=16000;channels=1',
  chunkIntervalMs: 250,
  durationUpdateMs: 250,
  maxActiveDurationMs: 30 * 60 * 1_000,
} as const;

export const AUDIO_DIRECTORIES = {
  root: 'hmmmidea-audio',
  drafts: 'drafts',
  captures: 'captures',
  uploads: 'hmmmidea-audio-uploads',
} as const;

export const LIVE_TRANSCRIPTION = {
  maxPendingChunks: 8,
  reconnectDelayMs: 750,
  openTimeoutMs: 5_000,
  sendTimeoutMs: 3_000,
  finishDrainTimeoutMs: 1_000,
  transcriptDedupeWindow: 512,
} as const;

export const PLAYBACK_UPDATE_INTERVAL_MS = 250;
