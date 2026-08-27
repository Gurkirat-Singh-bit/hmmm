import { Directory, File, Paths } from 'expo-file-system';

import type { TrimAudioResult } from '@siteed/audio-studio';

import type { AudioAsset, AudioFilePort, NormalizedError } from '../domain/contracts';
import { domainError, normalizeError } from '../domain/errors';
import { AUDIO_DIRECTORIES, RECORDING_AUDIO } from './constants';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const WAV_HEADER_BYTES = 44;

export type ProviderAudioLimits = Readonly<{
  acceptedMimeTypes: readonly string[];
  maxBytes: number | null;
  maxDurationMs: number | null;
  preferredFormat: 'wav' | 'aac' | 'opus' | null;
  sampleRateHz?: number;
  channelCount?: number;
  bitRateBps?: number;
}>;

export type PreparedAudioUpload = Readonly<{
  parts: readonly AudioAsset[];
  temporary: boolean;
  cleanup(): Promise<void>;
}>;

function safeId(value: string, label: string): string {
  if (!SAFE_ID.test(value)) {
    throw domainError('unsupported', 'recording', `${label} is not a valid app-owned audio identifier.`);
  }
  return value;
}

function ensureDirectory(directory: Directory): Directory {
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function draftDirectoryPath(): Directory {
  return new Directory(Paths.document, AUDIO_DIRECTORIES.root, AUDIO_DIRECTORIES.drafts);
}

function captureDirectoryPath(): Directory {
  return new Directory(Paths.document, AUDIO_DIRECTORIES.root, AUDIO_DIRECTORIES.captures);
}

export function recordingDraftDirectory(): Directory {
  return ensureDirectory(draftDirectoryPath());
}

export function captureAudioDirectory(): Directory {
  return ensureDirectory(captureDirectoryPath());
}

function uploadDirectory(requestId: string): Directory {
  return ensureDirectory(new Directory(Paths.cache, AUDIO_DIRECTORIES.uploads, safeId(requestId, 'Upload request ID')));
}

export function recordingDraftFile(recoveryId: string): File {
  return new File(recordingDraftDirectory(), `${safeId(recoveryId, 'Recording recovery ID')}.wav`);
}

function toFileUri(uri: string): string {
  return uri.startsWith('/') ? `file://${uri}` : uri;
}

function appOwnedDirectories(): readonly Directory[] {
  return [draftDirectoryPath(), captureDirectoryPath()];
}

function isInside(uri: string, directory: Directory): boolean {
  const normalized = decodeURIComponent(toFileUri(uri));
  if (normalized.split('/').includes('..')) return false;
  const directoryUri = decodeURIComponent(directory.uri);
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return normalized.startsWith(prefix);
}

export function isAppOwnedAudioUri(uri: string): boolean {
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    return false;
  }
  try {
    return appOwnedDirectories().some((directory) => isInside(uri, directory));
  } catch {
    return false;
  }
}

function appOwnedAudioFile(uri: string): File {
  if (!isAppOwnedAudioUri(uri)) {
    throw domainError('unsupported', 'recording', 'The audio file is outside app-owned storage.');
  }
  return new File(toFileUri(uri));
}

export function requireAppOwnedAudioFile(uri: string): File {
  const file = appOwnedAudioFile(uri);
  if (!file.info().exists) {
    throw domainError('not-found', 'recording', 'The source audio file is missing.');
  }
  return file;
}

export class AppOwnedAudioFiles implements AudioFilePort {
  async exists(uri: string): Promise<boolean> {
    return appOwnedAudioFile(uri).info().exists;
  }

  async delete(uri: string): Promise<void> {
    const file = appOwnedAudioFile(uri);
    if (file.info().exists) file.delete();
  }

  async listAppOwnedAudioUris(): Promise<readonly string[]> {
    const uris = new Set<string>();
    for (const directory of appOwnedDirectories()) {
      if (!directory.info().exists) continue;
      for (const entry of directory.list()) {
        if (entry instanceof File && isAppOwnedAudioUri(entry.uri)) uris.add(entry.uri);
      }
    }
    return [...uris];
  }
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw domainError('storage-failed', 'recording', `The audio file has invalid ${label} metadata.`);
  }
  return value;
}

export function validateAudioAsset(audio: AudioAsset): AudioAsset {
  const file = requireAppOwnedAudioFile(audio.uri);
  positive(audio.sampleRateHz, 'sample rate');
  positive(audio.channelCount, 'channel count');
  positive(audio.bitRateBps, 'bit rate');
  positive(audio.durationMs, 'duration');
  if (!/^[a-z0-9]{1,10}$/u.test(audio.container) || !audio.mimeType.startsWith('audio/')) {
    throw domainError('storage-failed', 'recording', 'The audio file has invalid format metadata.');
  }
  if (file.size < WAV_HEADER_BYTES || audio.byteLength !== file.size) {
    throw domainError('storage-failed', 'recording', 'The audio file size does not match its metadata.');
  }
  if (audio.container === 'wav') {
    const wav = readRecoveredWav(file);
    if (
      wav.sampleRateHz !== audio.sampleRateHz ||
      wav.channelCount !== audio.channelCount ||
      wav.bitRateBps !== audio.bitRateBps ||
      Math.abs(wav.durationMs - audio.durationMs) > 100
    ) {
      throw domainError('storage-failed', 'recording', 'The audio metadata does not match the WAV file.');
    }
  }
  return audio;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let result = '';
  for (let index = offset; index < offset + length; index += 1) result += String.fromCharCode(bytes[index]);
  return result;
}

function uint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

export function readRecoveredWav(file: File): AudioAsset {
  const handle = file.open();
  let header: Uint8Array;
  try {
    header = handle.readBytes(WAV_HEADER_BYTES);
  } finally {
    handle.close();
  }

  if (
    header.length !== WAV_HEADER_BYTES ||
    readAscii(header, 0, 4) !== 'RIFF' ||
    readAscii(header, 8, 4) !== 'WAVE' ||
    readAscii(header, 12, 4) !== 'fmt ' ||
    readAscii(header, 36, 4) !== 'data' ||
    uint16(header, 20) !== 1
  ) {
    throw domainError('storage-failed', 'recording', 'A recovered recording is not a valid PCM WAV file.');
  }

  const channelCount = positive(uint16(header, 22), 'channel count');
  const sampleRateHz = positive(uint32(header, 24), 'sample rate');
  const byteRate = positive(uint32(header, 28), 'byte rate');
  const declaredDataBytes = uint32(header, 40);
  const dataBytes = positive(file.size - WAV_HEADER_BYTES, 'data length');
  const durationMs = Math.round((dataBytes * 1_000) / byteRate);
  if (
    declaredDataBytes > dataBytes ||
    dataBytes % positive(uint16(header, 32), 'block alignment') !== 0 ||
    durationMs > RECORDING_AUDIO.maxActiveDurationMs + 2_000
  ) {
    throw domainError('storage-failed', 'recording', 'A recovered recording has inconsistent WAV metadata.');
  }

  return {
    uri: file.uri,
    container: 'wav',
    mimeType: 'audio/wav',
    sampleRateHz,
    channelCount,
    bitRateBps: byteRate * 8,
    durationMs,
    byteLength: file.size,
  };
}

export function listRecoverableAudio(): readonly AudioAsset[] {
  return inspectRecordingRecovery().flatMap((candidate) => (candidate.audio ? [candidate.audio] : []));
}

export type RecordingRecoveryCandidate = Readonly<{
  uri: string;
  audio: AudioAsset | null;
  error: NormalizedError | null;
}>;

export function inspectRecordingRecovery(): readonly RecordingRecoveryCandidate[] {
  return recordingDraftDirectory()
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.extension.toLowerCase() === '.wav')
    .map((file) => {
      try {
        return { uri: file.uri, audio: readRecoveredWav(file), error: null };
      } catch (error) {
        return { uri: file.uri, audio: null, error: normalizeError(error, 'recording') };
      }
    });
}

export function promoteRecordingAudio(audio: AudioAsset, captureId: string): AudioAsset {
  if (!/^[a-z0-9]{1,10}$/u.test(audio.container)) {
    throw domainError('storage-failed', 'recording', 'The audio file has invalid container metadata.');
  }
  const destination = new File(captureAudioDirectory(), `${safeId(captureId, 'Capture ID')}.${audio.container}`);
  const source = appOwnedAudioFile(audio.uri);
  if (!source.exists) {
    if (destination.exists) return validateAudioAsset({ ...audio, uri: destination.uri, byteLength: destination.size });
    throw domainError('not-found', 'recording', 'The source audio file is missing.');
  }
  validateAudioAsset(audio);
  if (!isInside(source.uri, recordingDraftDirectory())) {
    if (source.uri !== destination.uri) {
      throw domainError('conflict', 'recording', 'Source audio is already retained for another capture.');
    }
    return audio;
  }
  if (destination.exists) {
    throw domainError('conflict', 'recording', 'Source audio already exists for this capture.');
  }
  source.move(destination);
  return validateAudioAsset({ ...audio, uri: destination.uri, byteLength: destination.size });
}

function formatFromAudio(audio: AudioAsset): 'wav' | 'aac' | 'opus' | null {
  if (audio.container === 'wav' || audio.mimeType === 'audio/wav' || audio.mimeType === 'audio/x-wav') return 'wav';
  if (audio.container === 'aac' || audio.container === 'm4a' || audio.mimeType.includes('aac')) return 'aac';
  if (audio.container === 'opus' || audio.mimeType.includes('opus')) return 'opus';
  return null;
}

function mimeForTrimResult(result: TrimAudioResult): string {
  return result.mimeType || (result.compression?.format === 'opus' ? 'audio/opus' : 'audio/aac');
}

function assetFromTrimResult(result: TrimAudioResult, destination: File): AudioAsset {
  const bitRateBps = result.compression?.bitrate ?? result.sampleRate * result.channels * result.bitDepth;
  return {
    uri: destination.uri,
    container: result.compression?.format ?? destination.extension.slice(1),
    mimeType: mimeForTrimResult(result),
    sampleRateHz: positive(result.sampleRate, 'sample rate'),
    channelCount: positive(result.channels, 'channel count'),
    bitRateBps: positive(bitRateBps, 'bit rate'),
    durationMs: positive(result.durationMs, 'duration'),
    byteLength: destination.size,
  };
}

function partDuration(audio: AudioAsset, limits: ProviderAudioLimits, targetBitRateBps: number): number {
  const byDuration = limits.maxDurationMs ?? audio.durationMs;
  const byBytes = limits.maxBytes == null ? audio.durationMs : Math.floor((limits.maxBytes * 8 * 1_000 * 0.9) / targetBitRateBps);
  const duration = Math.floor(Math.min(audio.durationMs, byDuration, byBytes));
  if (duration < 1) {
    throw domainError('provider-rejected', 'transcription', 'The speech provider audio limit is too small.');
  }
  return duration;
}

export async function prepareProviderAudioUpload(
  audio: AudioAsset,
  limits: ProviderAudioLimits,
  requestId: string,
): Promise<PreparedAudioUpload> {
  validateAudioAsset(audio);
  const mimeAccepted = limits.acceptedMimeTypes.length === 0 || limits.acceptedMimeTypes.includes(audio.mimeType);
  const tooLarge =
    (limits.maxBytes != null && audio.byteLength > limits.maxBytes) ||
    (limits.maxDurationMs != null && audio.durationMs > limits.maxDurationMs);
  const sourceFormat = formatFromAudio(audio);
  const formatAdjustment =
    (limits.preferredFormat != null && limits.preferredFormat !== sourceFormat) ||
    (limits.sampleRateHz != null && limits.sampleRateHz !== audio.sampleRateHz) ||
    (limits.channelCount != null && limits.channelCount !== audio.channelCount) ||
    (limits.bitRateBps != null && limits.bitRateBps !== audio.bitRateBps);
  if (mimeAccepted && !tooLarge && !formatAdjustment) {
    return { parts: [audio], temporary: false, cleanup: async () => undefined };
  }

  const targetFormat = limits.preferredFormat ?? (mimeAccepted ? sourceFormat : null);
  if (!targetFormat) {
    throw domainError('unsupported', 'transcription', 'The source audio cannot be converted to a provider-supported format.');
  }

  const directory = uploadDirectory(requestId);
  try {
    for (const stale of directory.list()) stale.delete();
  } catch {
    throw domainError('storage-failed', 'file-cleanup', 'Stale provider audio could not be removed.', true);
  }
  const targetBitRateBps = limits.bitRateBps ?? (targetFormat === 'wav' ? audio.bitRateBps : 64_000);
  const durationPerPart = partDuration(audio, limits, targetBitRateBps);
  const temporaryFiles: File[] = [];
  const parts: AudioAsset[] = [];

  const cleanup = async () => {
    let cleanupFailed = false;
    for (const file of temporaryFiles) {
      try {
        if (file.exists) file.delete();
      } catch {
        cleanupFailed = true;
      }
    }
    try {
      if (directory.exists && directory.list().length === 0) directory.delete();
    } catch {
      cleanupFailed = true;
    }
    if (cleanupFailed) throw domainError('storage-failed', 'file-cleanup', 'Temporary provider audio could not be fully removed.', true);
  };

  try {
    const { trimAudio } = await import('@siteed/audio-studio');
    for (let startMs = 0, index = 0; startMs < audio.durationMs; startMs += durationPerPart, index += 1) {
      const endMs = Math.min(audio.durationMs, startMs + durationPerPart);
      const baseName = `hmmm-upload-${safeId(requestId, 'Upload request ID')}-${index}`;
      for (const extension of ['wav', 'aac', 'opus']) {
        temporaryFiles.push(new File(Paths.document, `${baseName}.${extension}`));
      }
      const result = await trimAudio({
        fileUri: audio.uri,
        startTimeMs: startMs,
        endTimeMs: endMs,
        outputFileName: baseName,
        outputFormat: {
          format: targetFormat,
          sampleRate: limits.sampleRateHz,
          channels: limits.channelCount,
          bitDepth: targetFormat === 'wav' ? 16 : undefined,
          bitrate: targetFormat === 'wav' ? undefined : targetBitRateBps,
        },
      });

      const generated = new File(toFileUri(result.uri));
      const destination = new File(directory, `${index}.${targetFormat}`);
      temporaryFiles.push(generated);
      generated.move(destination);
      temporaryFiles.push(destination);
      const part = assetFromTrimResult(result, destination);
      if (limits.maxBytes != null && part.byteLength > limits.maxBytes) {
        throw domainError('provider-rejected', 'transcription', 'A prepared audio part exceeds the speech provider size limit.');
      }
      if (limits.maxDurationMs != null && part.durationMs > limits.maxDurationMs + 50) {
        throw domainError('provider-rejected', 'transcription', 'A prepared audio part exceeds the speech provider duration limit.');
      }
      if (limits.acceptedMimeTypes.length > 0 && !limits.acceptedMimeTypes.includes(part.mimeType)) {
        throw domainError('unsupported', 'transcription', 'The converted audio format is not accepted by the speech provider.');
      }
      parts.push(part);
    }

    return { parts, temporary: true, cleanup };
  } catch (error) {
    try {
      await cleanup();
    } catch {
      throw domainError('storage-failed', 'file-cleanup', 'Temporary provider audio could not be fully removed.', true);
    }
    const normalized = normalizeError(error, 'transcription');
    throw domainError(normalized.code, normalized.operation, normalized.message, normalized.retryable, normalized.occurredAt);
  }
}

export async function withPreparedProviderAudio<T>(
  audio: AudioAsset,
  limits: ProviderAudioLimits,
  requestId: string,
  upload: (parts: readonly AudioAsset[]) => Promise<T>,
): Promise<T> {
  const prepared = await prepareProviderAudioUpload(audio, limits, requestId);
  try {
    return await upload(prepared.parts);
  } finally {
    if (prepared.temporary) await prepared.cleanup();
  }
}
