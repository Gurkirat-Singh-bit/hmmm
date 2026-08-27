import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import type {
  AppPreferencesRecord,
  AudioAsset,
  CaptureRecord,
  CleanupQueueRecord,
  DataGeneration,
  DeletionReceipt,
  DeletionRequest,
  DeletionTombstoneRecord,
  DiscussionDraftRecord,
  ExportCapture,
  ExportedJobHistory,
  MessageRecord,
  NonSecretExportBundle,
  NormalizedError,
  RecordingDraftRecord,
  ReportContent,
  ReportField,
  ReportProvenance,
  ReportRecord,
  ReportUpdateProposal,
  SourceRecord,
  TranscriptSnapshot,
} from '../domain/contracts';
import { domainError } from '../domain/errors';
import { CLEANUP_RULES } from './contracts';
import type {
  JobEnqueueInput,
  JobPayload,
  JobRecord,
  JobRepository as JobRepositoryContract,
  ReportJobPayload,
} from '../jobs/contracts';
import type {
  AppRepositories,
  AppendReportRevisionInput,
  AppendUserMessageInput,
  CaptureQuery,
  CaptureRepository,
  CleanupQueueRepository,
  CommitRecordingInput,
  DeletionRepository,
  DiscussionDraftRepository,
  ExportSnapshotRepository,
  MessageRepository,
  PreferencesRepository,
  RecordingDraftRepository,
  ReportRepository,
} from './contracts';
import { SqliteStore } from './connection';

type CaptureRow = {
  id: string;
  generation: number;
  title: string | null;
  summary: string | null;
  kind: string | null;
  status: CaptureRecord['status'];
  transcript_json: string | null;
  audio_json: string | null;
  duration_ms: number;
  starred: number;
  active_report_revision: number | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
};

type ReportRow = {
  capture_id: string;
  generation: number;
  revision: number;
  request_id: string;
  phase: ReportRecord['phase'];
  origin: ReportRecord['origin'];
  supersedes_revision: number | null;
  transcript_revision: number;
  content_json: string;
  provenance_json: string;
  provider_id: string | null;
  model: string | null;
  created_at: string;
};

type SourceRow = {
  id: string;
  capture_id: string;
  report_revision: number;
  title: string;
  url: string;
  domain: string;
  published_at: string | null;
  accessed_at: string;
};

type MessageRow = {
  id: string;
  capture_id: string;
  generation: number;
  role: MessageRecord['role'];
  content: string;
  status: MessageRecord['status'];
  client_request_id: string;
  reply_to_message_id: string | null;
  report_revision: number | null;
  last_sequence: number;
  proposal_json: string | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  capture_id: string;
  generation: number;
  kind: JobRecord['kind'];
  revision: number;
  request_id: string;
  status: JobRecord['status'];
  attempts: number;
  max_attempts: number;
  run_after: string;
  lease_expires_at: string | null;
  last_error_json: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type CleanupRow = {
  id: string;
  operation_id: string;
  kind: 'delete-audio';
  uri: string;
  status: CleanupQueueRecord['status'];
  attempts: number;
  run_after: string;
  last_error_json: string | null;
  created_at: string;
  updated_at: string;
};

type GenerationRow = { generation: number };

const reportFields = ['gist', 'evidence', 'risks', 'nextMove', 'verdict'] as const satisfies readonly ReportField[];
const reportJobReasons = ['initial-capture', 'explicit-regenerate', 'discussion-update'] as const;

function isReportField(value: unknown): value is ReportField {
  return reportFields.some((candidate) => candidate === value);
}

function isReportJobReason(value: unknown): value is ReportJobPayload['reason'] {
  return reportJobReasons.some((candidate) => candidate === value);
}

const defaultPreferences: AppPreferencesRecord = {
  id: 'app',
  displayName: '',
  languageTag: 'en',
  onboardingComplete: false,
  researchEnabled: false,
  researchConsent: { status: 'unknown', policyVersion: null, decidedAt: null },
  notifications: { enabled: false, reportReady: true, processingFailed: true },
  speechProvider: { providerId: '', model: '', endpoint: null },
  aiProvider: { providerId: '', model: '', endpoint: null },
  customSystemPrompt: null,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function json(value: unknown) {
  return JSON.stringify(value);
}

function parse<T>(value: string | null): T | null {
  return value === null ? null : JSON.parse(value) as T;
}

function parseJobPayload(value: string): JobPayload {
  const payload = JSON.parse(value) as unknown;
  if (!payload || typeof payload !== 'object') {
    throw domainError('storage-failed', 'database', 'A persisted job payload is invalid.');
  }
  const record = payload as Record<string, unknown>;
  if (record.kind !== 'generate-report') return payload as JobPayload;

  const transcriptRevision = record.transcriptRevision;
  const expectedActiveRevision = record.expectedActiveRevision;
  const researchEnabled = record.researchEnabled;
  const reason = record.reason;
  if (typeof transcriptRevision !== 'number' || !Number.isInteger(transcriptRevision) || transcriptRevision < 0
    || !(expectedActiveRevision === undefined || expectedActiveRevision === null
      || (typeof expectedActiveRevision === 'number' && Number.isInteger(expectedActiveRevision) && expectedActiveRevision >= 1))
    || typeof researchEnabled !== 'boolean'
    || !isReportJobReason(reason)) {
    throw domainError('storage-failed', 'database', 'A persisted report job payload is invalid.');
  }

  const fields = record.explicitlyReplacedUserFields;
  const normalizedFields: ReportField[] = fields === undefined ? [] : Array.isArray(fields)
    ? fields.map((field) => {
      if (!isReportField(field)) {
        throw domainError('storage-failed', 'database', 'A persisted report job lists an invalid user-owned field.');
      }
      return field;
    })
    : (() => {
      throw domainError('storage-failed', 'database', 'A persisted report job lists an invalid user-owned field.');
    })();
  if (new Set(normalizedFields).size !== normalizedFields.length) {
    throw domainError('storage-failed', 'database', 'A persisted report job lists a user-owned field more than once.');
  }
  const reportPayload: ReportJobPayload = {
    kind: 'generate-report',
    transcriptRevision,
    // Legacy jobs lacked this barrier; null preserves initial jobs and conflicts if a report is active.
    expectedActiveRevision: expectedActiveRevision === undefined ? null : expectedActiveRevision,
    researchEnabled,
    reason,
    explicitlyReplacedUserFields: normalizedFields,
  };
  return reportPayload;
}

function requireReportFields(fields: unknown): asserts fields is readonly ReportField[] {
  if (!Array.isArray(fields)
    || fields.some((field) => typeof field !== 'string' || !reportFields.includes(field as ReportField))
    || new Set(fields).size !== fields.length) {
    throw domainError('conflict', 'database', 'Report jobs may replace only known user-owned fields.');
  }
}

function nowIso() {
  return new Date().toISOString();
}

function requireGeneration(generation: DataGeneration) {
  if (!Number.isInteger(generation) || generation < 0) {
    throw domainError('conflict', 'database', 'The data generation is invalid.');
  }
}

async function currentGeneration(database: SQLiteDatabase): Promise<DataGeneration> {
  const row = await database.getFirstAsync<GenerationRow>(
    'SELECT generation FROM data_generation WHERE id = 1',
  );
  if (!row) throw domainError('storage-failed', 'database', 'The data generation could not be read.', true);
  requireGeneration(row.generation);
  return row.generation;
}

async function requireCurrentGeneration(database: SQLiteDatabase, expected: DataGeneration) {
  requireGeneration(expected);
  const actual = await currentGeneration(database);
  if (actual !== expected) {
    throw domainError('cancelled', 'database', 'The operation belongs to data that was deleted.');
  }
}

function requireUtc(...values: readonly string[]) {
  for (const value of values) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
      throw domainError('conflict', 'database', 'Timestamps must be UTC ISO-8601 values.');
    }
  }
}

function requireHttps(source: Pick<SourceRecord, 'url' | 'domain'>) {
  let parsed: URL;
  try {
    parsed = new URL(source.url);
  } catch {
    throw domainError('invalid-url', 'database', 'A research source URL is invalid.');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const domain = source.domain.toLowerCase().replace(/^www\./, '');
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !hostname || hostname !== domain) {
    throw domainError('invalid-url', 'database', 'Research sources must use credential-free HTTPS URLs.');
  }
}

function requireSafeEndpoint(value: string | null) {
  if (!value) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw domainError('invalid-url', 'database', 'The provider endpoint is invalid.');
  }
  const hasCredentialParameter = [...parsed.searchParams.keys()].some((key) =>
    /(?:^|[-_])(api[-_]?key|key|token|auth(?:orization)?|bearer|secret|password|credential|signature|sig|subscription[-_]?key)(?:$|[-_])/i.test(key),
  );
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash
    || hasCredentialParameter) {
    throw domainError('invalid-url', 'database', 'Provider endpoints must be credential-free HTTPS URLs.');
  }
}

function requireAudio(audio: AudioAsset) {
  if (!audio.uri || !audio.container || !audio.mimeType || audio.sampleRateHz <= 0 || audio.channelCount <= 0
    || audio.bitRateBps <= 0 || audio.durationMs < 0 || audio.byteLength < 0
    || ![audio.sampleRateHz, audio.channelCount, audio.bitRateBps, audio.durationMs, audio.byteLength].every(Number.isFinite)) {
    throw domainError('conflict', 'database', 'The recording metadata is incomplete.');
  }
}

function mapCapture(row: CaptureRow): CaptureRecord {
  return {
    id: row.id,
    generation: row.generation,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    status: row.status,
    transcript: parse<TranscriptSnapshot>(row.transcript_json),
    audio: parse<AudioAsset>(row.audio_json),
    durationMs: row.duration_ms,
    starred: row.starred === 1,
    activeReportRevision: row.active_report_revision,
    error: parse<NormalizedError>(row.error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(row: ReportRow): ReportRecord {
  return {
    captureId: row.capture_id,
    generation: row.generation,
    revision: row.revision,
    requestId: row.request_id,
    phase: row.phase,
    origin: row.origin,
    supersedesRevision: row.supersedes_revision,
    transcriptRevision: row.transcript_revision,
    content: JSON.parse(row.content_json) as ReportContent,
    provenance: JSON.parse(row.provenance_json) as ReportProvenance,
    providerId: row.provider_id,
    model: row.model,
    createdAt: row.created_at,
  };
}

function mapSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    reportRevision: row.report_revision,
    title: row.title,
    url: row.url,
    domain: row.domain,
    publishedAt: row.published_at,
    accessedAt: row.accessed_at,
  };
}

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    generation: row.generation,
    role: row.role,
    content: row.content,
    status: row.status,
    clientRequestId: row.client_request_id,
    replyToMessageId: row.reply_to_message_id,
    reportRevision: row.report_revision,
    lastSequence: row.last_sequence,
    reportUpdateProposal: parse<ReportUpdateProposal>(row.proposal_json),
    error: parse<NormalizedError>(row.error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    generation: row.generation,
    kind: row.kind,
    revision: row.revision,
    requestId: row.request_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    leaseExpiresAt: row.lease_expires_at,
    lastError: parse<NormalizedError>(row.last_error_json),
    payload: parseJobPayload(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  } as JobRecord;
}

function mapCleanup(row: CleanupRow): CleanupQueueRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    kind: row.kind,
    uri: row.uri,
    status: row.status,
    attempts: row.attempts,
    runAfter: row.run_after,
    lastError: parse(row.last_error_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transcriptColumns(transcript: TranscriptSnapshot | null) {
  return transcript
    ? [json(transcript), transcript.phase, transcript.revision, transcript.requestId] as const
    : [null, null, null, null] as const;
}

async function getCapture(database: SQLiteDatabase, id: string) {
  const row = await database.getFirstAsync<CaptureRow>('SELECT * FROM captures WHERE id = ?', [id]);
  return row ? mapCapture(row) : null;
}

function jobId(input: JobEnqueueInput) {
  return `job:${json([input.captureId, input.payload.kind, input.revision])}`;
}

async function insertJob(database: SQLiteDatabase, input: JobEnqueueInput): Promise<JobRecord> {
  requireUtc(input.runAfter);
  requireGeneration(input.generation);
  await requireCurrentGeneration(database, input.generation);
  if (!Number.isInteger(input.revision) || !Number.isInteger(input.maxAttempts)
    || input.revision < 1 || input.maxAttempts < 1) {
    throw domainError('conflict', 'database', 'Job revisions and attempt limits must be positive.');
  }
  if (input.payload.kind === 'transcribe-capture') requireAudio(input.payload.audio);
  else requireReportFields(input.payload.explicitlyReplacedUserFields);
  const existing = await database.getFirstAsync<JobRow>(
    'SELECT * FROM jobs WHERE capture_id = ? AND kind = ? AND revision = ?',
    [input.captureId, input.payload.kind, input.revision],
  );
  if (existing) {
    if (existing.generation !== input.generation || existing.request_id !== input.requestId
      || json(parseJobPayload(existing.payload_json)) !== json(input.payload)) {
      throw domainError('conflict', 'database', 'This job revision already belongs to another request.');
    }
    return mapJob(existing);
  }

  const capture = await getCapture(database, input.captureId);
  if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
  if (capture.generation !== input.generation) {
    throw domainError('cancelled', 'database', 'The job belongs to data that was deleted.');
  }
  const createdAt = nowIso();
  const inputRevision = input.payload.kind === 'transcribe-capture'
    ? input.payload.expectedTranscriptRevision
    : input.payload.transcriptRevision;
  await database.runAsync(
    `INSERT INTO jobs (
      id, capture_id, generation, kind, revision, request_id, status, attempts, max_attempts, run_after,
      lease_expires_at, last_error_json, payload_json, input_revision, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`,
    [jobId(input), input.captureId, input.generation, input.payload.kind, input.revision, input.requestId, input.maxAttempts,
      input.runAfter, json(input.payload), inputRevision, createdAt, createdAt],
  );
  const saved = await database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [jobId(input)]);
  if (!saved) throw domainError('storage-failed', 'database', 'The job could not be saved.', true);
  return mapJob(saved);
}

class SqliteRecordingDraftRepository implements RecordingDraftRepository {
  constructor(private readonly store: SqliteStore) {}

  async get(id: string) {
    const row = await this.store.read((database) => database.getFirstAsync<{
      id: string; capture_id: string; recovery_id: string; generation: number; status: RecordingDraftRecord['status'];
      audio_json: string | null; transcript_json: string | null; duration_ms: number; error_json: string | null;
      created_at: string; updated_at: string;
    }>('SELECT * FROM recording_drafts WHERE id = ?', [id]));
    return row ? {
      id: row.id,
      captureId: row.capture_id,
      generation: row.generation,
      recoveryId: row.recovery_id,
      status: row.status,
      audio: parse<AudioAsset>(row.audio_json),
      transcript: parse<TranscriptSnapshot>(row.transcript_json),
      durationMs: row.duration_ms,
      error: parse<NormalizedError>(row.error_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } : null;
  }

  async list() {
    const rows = await this.store.read((database) => database.getAllAsync<{
      id: string; capture_id: string; recovery_id: string; generation: number; status: RecordingDraftRecord['status'];
      audio_json: string | null; transcript_json: string | null; duration_ms: number; error_json: string | null;
      created_at: string; updated_at: string;
    }>('SELECT * FROM recording_drafts ORDER BY created_at, id'));
    return rows.map((row) => ({
      id: row.id,
      captureId: row.capture_id,
      generation: row.generation,
      recoveryId: row.recovery_id,
      status: row.status,
      audio: parse<AudioAsset>(row.audio_json),
      transcript: parse<TranscriptSnapshot>(row.transcript_json),
      durationMs: row.duration_ms,
      error: parse<NormalizedError>(row.error_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  save(draft: RecordingDraftRecord) {
    requireUtc(draft.createdAt, draft.updatedAt);
    requireGeneration(draft.generation);
    if (draft.audio) requireAudio(draft.audio);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, draft.generation);
      const existing = await database.getFirstAsync<{ capture_id: string; recovery_id: string; generation: number }>(
        'SELECT capture_id, recovery_id, generation FROM recording_drafts WHERE id = ?',
        [draft.id],
      );
      if (existing && (existing.capture_id !== draft.captureId || existing.recovery_id !== draft.recoveryId
        || existing.generation !== draft.generation)) {
        throw domainError('conflict', 'database', 'A recording draft cannot change its recovery identity.');
      }
      await database.runAsync(
        `INSERT INTO recording_drafts (
          id, capture_id, recovery_id, generation, status, audio_json, transcript_json, duration_ms, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          audio_json = excluded.audio_json, transcript_json = excluded.transcript_json,
          duration_ms = excluded.duration_ms, error_json = excluded.error_json, updated_at = excluded.updated_at`,
        [draft.id, draft.captureId, draft.recoveryId, draft.generation, draft.status, draft.audio ? json(draft.audio) : null,
          draft.transcript ? json(draft.transcript) : null, draft.durationMs, draft.error ? json(draft.error) : null,
          draft.createdAt, draft.updatedAt],
      );
    });
  }

  delete(id: string, expectedGeneration: DataGeneration) {
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        'DELETE FROM recording_drafts WHERE id = ? AND generation = ?',
        [id, expectedGeneration],
      );
    });
  }
}

class SqliteCaptureRepository implements CaptureRepository {
  constructor(private readonly store: SqliteStore) {}

  get(id: string) {
    return this.store.read((database) => getCapture(database, id));
  }

  async list(query: CaptureQuery) {
    const clauses: string[] = [];
    const parameters: Array<string | number> = [];
    const search = query.search.trim().toLowerCase();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      clauses.push(`(
        lower(COALESCE(title, '')) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(summary, '')) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(transcript_text, '')) LIKE ? ESCAPE '\\'
      )`);
      parameters.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }
    if (query.starred !== null) {
      clauses.push('starred = ?');
      parameters.push(query.starred ? 1 : 0);
    }
    if (query.statuses.length) {
      clauses.push(`status IN (${query.statuses.map(() => '?').join(', ')})`);
      parameters.push(...query.statuses);
    }
    const orders: Record<CaptureQuery['sort'], string> = {
      newest: 'created_at DESC, id DESC',
      oldest: 'created_at ASC, id ASC',
      'title-asc': "lower(COALESCE(title, '')) ASC, created_at DESC",
      'title-desc': "lower(COALESCE(title, '')) DESC, created_at DESC",
    };
    parameters.push(query.limit ?? -1, query.offset);
    const rows = await this.store.read((database) => database.getAllAsync<CaptureRow>(
      `SELECT * FROM captures ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY ${orders[query.sort]} LIMIT ? OFFSET ?`,
      parameters,
    ));
    return rows.map(mapCapture);
  }

  async listRecent(limit: number) {
    const rows = await this.store.read((database) => database.getAllAsync<CaptureRow>(
      'SELECT * FROM captures ORDER BY created_at DESC, id DESC LIMIT ?',
      [Math.max(0, limit)],
    ));
    return rows.map(mapCapture);
  }

  commitRecording(input: CommitRecordingInput) {
    requireUtc(input.capture.createdAt, input.capture.updatedAt);
    requireGeneration(input.capture.generation);
    if (!input.capture.audio) throw domainError('conflict', 'database', 'A saved capture requires source audio.');
    if (input.capture.activeReportRevision !== null) {
      throw domainError('conflict', 'database', 'A new capture cannot already have an active report.');
    }
    requireAudio(input.capture.audio);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.capture.generation);
      const existing = await getCapture(database, input.capture.id);
      if (existing) return existing;
      const draft = await database.getFirstAsync<{ capture_id: string; generation: number }>(
        'SELECT capture_id, generation FROM recording_drafts WHERE id = ?',
        [input.draftId],
      );
      if (!draft || draft.capture_id !== input.capture.id) {
        throw domainError('conflict', 'database', 'The recording draft no longer matches this capture.');
      }
      if (draft.generation !== input.capture.generation) {
        throw domainError('cancelled', 'database', 'The recording belongs to data that was deleted.');
      }
      const [transcriptJson, transcriptPhase, transcriptRevision, transcriptRequestId] = transcriptColumns(input.capture.transcript);
      await database.runAsync(
        `INSERT INTO captures (
          id, generation, title, summary, kind, status, transcript_json, transcript_text, transcript_phase, transcript_revision,
          transcript_request_id, audio_json, duration_ms, starred, active_report_revision,
          error_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.capture.id, input.capture.generation, input.capture.title, input.capture.summary, input.capture.kind, input.capture.status,
          transcriptJson, input.capture.transcript?.text ?? null, transcriptPhase, transcriptRevision, transcriptRequestId,
          input.capture.audio ? json(input.capture.audio) : null, input.capture.durationMs,
          input.capture.starred ? 1 : 0, input.capture.activeReportRevision,
          input.capture.error ? json(input.capture.error) : null, input.capture.createdAt, input.capture.updatedAt],
      );
      for (const job of input.jobs) {
        if (job.captureId !== input.capture.id) {
          throw domainError('conflict', 'database', 'A capture cannot enqueue work for another capture.');
        }
        await insertJob(database, job);
      }
      await database.runAsync('DELETE FROM recording_drafts WHERE id = ?', [input.draftId]);
      return (await getCapture(database, input.capture.id))!;
    });
  }

  setStarred(id: string, starred: boolean, updatedAt: string, expectedGeneration: DataGeneration) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        'UPDATE captures SET starred = ?, updated_at = ? WHERE id = ? AND generation = ?',
        [starred ? 1 : 0, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, 'The capture was not found.');
    });
  }

  setProcessingState(id: string, status: CaptureRecord['status'], error: NormalizedError | null, updatedAt: string, expectedGeneration: DataGeneration) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        'UPDATE captures SET status = ?, error_json = ?, updated_at = ? WHERE id = ? AND generation = ?',
        [status, error ? json(error) : null, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, 'The capture was not found.');
    });
  }

  queueProcessing(input: Parameters<CaptureRepository['queueProcessing']>[0]) {
    requireUtc(input.updatedAt, input.job.runAfter);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.id);
      if (!capture) throw domainError('not-found', 'database', 'The capture was not found.');
      if (capture.generation !== input.expectedGeneration) {
        throw domainError('cancelled', 'database', 'The capture belongs to data that was deleted.');
      }
      if (input.job.captureId !== input.id || input.job.generation !== input.expectedGeneration) {
        throw domainError('conflict', 'database', 'The processing job does not match the capture.');
      }
      await database.runAsync(
        'UPDATE captures SET status = ?, error_json = ?, updated_at = ? WHERE id = ? AND generation = ?',
        [input.status, input.error ? json(input.error) : null, input.updatedAt, input.id, input.expectedGeneration],
      );
      return insertJob(database, input.job);
    });
  }

  replaceTranscript(id: string, expectedRevision: number, transcript: TranscriptSnapshot, updatedAt: string, expectedGeneration: DataGeneration) {
    requireUtc(transcript.createdAt, updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const capture = await getCapture(database, id);
      if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
      if (capture.generation !== expectedGeneration) throw domainError('cancelled', 'database', 'The capture was deleted.');
      if (capture.transcript?.phase === 'final') {
        if (capture.transcript.requestId === transcript.requestId) return;
        throw domainError('conflict', 'database', 'The final transcript cannot be overwritten.');
      }
      if ((capture.transcript?.revision ?? 0) !== expectedRevision || transcript.revision !== expectedRevision + 1) {
        throw domainError('conflict', 'database', 'The transcript changed before this update was saved.');
      }
      await database.runAsync(
        `UPDATE captures SET transcript_json = ?, transcript_text = ?, transcript_phase = ?, transcript_revision = ?,
         transcript_request_id = ?, updated_at = ? WHERE id = ? AND generation = ?`,
        [json(transcript), transcript.text, transcript.phase, transcript.revision, transcript.requestId, updatedAt, id, expectedGeneration],
      );
    });
  }

  completeTranscription(input: Parameters<CaptureRepository['completeTranscription']>[0]) {
    requireUtc(input.transcript.createdAt, ...(input.reportJob ? [input.reportJob.runAfter] : []), input.updatedAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.id);
      if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
      if (capture.generation !== input.expectedGeneration) throw domainError('cancelled', 'database', 'The capture was deleted.');
      if (input.reportJob && (input.reportJob.captureId !== input.id || input.reportJob.payload.kind !== 'generate-report'
        || input.reportJob.payload.transcriptRevision !== input.transcript.revision)) {
        throw domainError('conflict', 'database', 'The report job does not match the completed transcript.');
      }
      if (capture.transcript?.phase === 'final') {
        if (capture.transcript.requestId !== input.transcript.requestId) {
          throw domainError('conflict', 'database', 'The final transcript cannot be overwritten.');
        }
        if (input.reportJob) await insertJob(database, input.reportJob);
        return capture;
      }
      if ((capture.transcript?.revision ?? 0) !== input.expectedRevision || input.transcript.revision !== input.expectedRevision + 1) {
        throw domainError('conflict', 'database', 'The transcript changed before transcription completed.');
      }
      if (!input.reportJob) {
        const provisional = await database.getFirstAsync<{ capture_id: string }>(
          `SELECT capture_id FROM reports
           WHERE capture_id = ? AND phase = 'provisional' AND transcript_revision = ?`,
          [input.id, input.expectedRevision],
        );
        if (!provisional) {
          throw domainError('conflict', 'database', 'A final transcript requires a report job unless it supersedes a provisional report.');
        }
      }
      await database.runAsync(
        `UPDATE captures SET transcript_json = ?, transcript_text = ?, transcript_phase = 'final', transcript_revision = ?,
         transcript_request_id = ?, status = 'queued', error_json = NULL, updated_at = ? WHERE id = ?`,
        [json(input.transcript), input.transcript.text, input.transcript.revision,
          input.transcript.requestId, input.updatedAt, input.id],
      );
      if (input.reportJob) await insertJob(database, input.reportJob);
      return (await getCapture(database, input.id))!;
    });
  }
}

function requireChanged(result: SQLiteRunResult, message: string) {
  if (result.changes === 0) throw domainError('not-found', 'database', message);
}

async function getReport(database: SQLiteDatabase, captureId: string, revision: number) {
  const row = await database.getFirstAsync<ReportRow>(
    'SELECT * FROM reports WHERE capture_id = ? AND revision = ?',
    [captureId, revision],
  );
  return row ? mapReport(row) : null;
}

async function reportSources(database: SQLiteDatabase, captureId: string, revision: number) {
  const rows = await database.getAllAsync<SourceRow>(
    'SELECT * FROM sources WHERE capture_id = ? AND report_revision = ? ORDER BY id',
    [captureId, revision],
  );
  return rows.map(mapSource);
}

function mergeReport(
  input: AppendReportRevisionInput,
  active: ReportRecord | null,
): Readonly<{ content: ReportContent; provenance: ReportProvenance; preservedEvidence: boolean }> {
  const explicit = new Set(input.explicitlyReplacedUserFields);
  const preserve = (field: ReportField) => input.origin === 'ai-generated'
    && active?.provenance[field].owner === 'user'
    && !explicit.has(field);
  return {
    content: {
      gist: preserve('gist') ? active!.content.gist : input.content.gist,
      evidence: preserve('evidence') ? active!.content.evidence : input.content.evidence,
      risks: preserve('risks') ? active!.content.risks : input.content.risks,
      nextMove: preserve('nextMove') ? active!.content.nextMove : input.content.nextMove,
      verdict: preserve('verdict') ? active!.content.verdict : input.content.verdict,
    },
    provenance: {
      gist: preserve('gist') ? active!.provenance.gist : input.provenance.gist,
      evidence: preserve('evidence') ? active!.provenance.evidence : input.provenance.evidence,
      risks: preserve('risks') ? active!.provenance.risks : input.provenance.risks,
      nextMove: preserve('nextMove') ? active!.provenance.nextMove : input.provenance.nextMove,
      verdict: preserve('verdict') ? active!.provenance.verdict : input.provenance.verdict,
    },
    preservedEvidence: preserve('evidence'),
  };
}

function validateReport(content: ReportContent, provenance: ReportProvenance, sources: readonly SourceRecord[]) {
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of sources) {
    requireUtc(source.accessedAt, ...(source.publishedAt ? [source.publishedAt] : []));
    requireHttps(source);
    if (sourceIds.has(source.id) || sourceUrls.has(source.url)) {
      throw domainError('conflict', 'database', 'Research sources must have unique IDs and URLs.');
    }
    sourceIds.add(source.id);
    sourceUrls.add(source.url);
  }
  for (const evidence of content.evidence) {
    if (evidence.sourceIds.some((id) => !sourceIds.has(id))) {
      throw domainError('invalid-provider-output', 'database', 'Report evidence references an unknown source.');
    }
  }
  for (const field of reportFields) requireUtc(provenance[field].changedAt);
}

class SqliteReportRepository implements ReportRepository {
  constructor(private readonly store: SqliteStore) {}

  get(captureId: string, revision: number) {
    return this.store.read((database) => getReport(database, captureId, revision));
  }

  async getActive(captureId: string) {
    const row = await this.store.read((database) => database.getFirstAsync<ReportRow>(
      `SELECT reports.* FROM reports
       JOIN captures ON captures.id = reports.capture_id AND captures.active_report_revision = reports.revision
       WHERE captures.id = ? AND reports.phase = 'final'`,
      [captureId],
    ));
    return row ? mapReport(row) : null;
  }

  async getLatestProvisional(captureId: string) {
    const row = await this.store.read((database) => database.getFirstAsync<ReportRow>(
      `SELECT * FROM reports WHERE capture_id = ? AND phase = 'provisional'
       ORDER BY revision DESC LIMIT 1`,
      [captureId],
    ));
    return row ? mapReport(row) : null;
  }

  async listRevisions(captureId: string) {
    const rows = await this.store.read((database) => database.getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE capture_id = ? ORDER BY revision DESC',
      [captureId],
    ));
    return rows.map(mapReport);
  }

  listSources(captureId: string, revision: number) {
    return this.store.read((database) => reportSources(database, captureId, revision));
  }

  appendRevision(input: AppendReportRevisionInput) {
    requireUtc(input.createdAt, ...(input.captureUpdate ? [input.captureUpdate.updatedAt] : []));
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const capture = await getCapture(database, input.captureId);
      if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
      if (capture.generation !== input.expectedGeneration) {
        throw domainError('cancelled', 'database', 'The report belongs to data that was deleted.');
      }
      const existing = await database.getFirstAsync<ReportRow>(
        'SELECT * FROM reports WHERE capture_id = ? AND request_id = ?',
        [input.captureId, input.requestId],
      );
      if (existing) {
        if (existing.phase !== input.phase || existing.transcript_revision !== input.transcriptRevision) {
          throw domainError('conflict', 'database', 'This report request already belongs to another revision.');
        }
        return mapReport(existing);
      }

      if (capture.transcript?.phase !== input.phase || capture.transcript.revision !== input.transcriptRevision) {
        throw domainError('conflict', 'database', `Reports require the matching ${input.phase} transcript.`);
      }
      if (capture.activeReportRevision !== input.expectedActiveRevision) {
        throw domainError('conflict', 'database', 'The report changed before this revision was saved.');
      }
      if (input.phase === 'provisional' && input.captureUpdate) {
        throw domainError('conflict', 'database', 'A provisional report cannot mark a capture ready.');
      }

      const active = capture.activeReportRevision === null
        ? null
        : await getReport(database, input.captureId, capture.activeReportRevision);
      const merged = mergeReport(input, active);
      const sourceInputs: SourceRecord[] = input.sources.map((source) => ({
        ...source,
        captureId: input.captureId,
        reportRevision: 0,
      }));
      if (merged.preservedEvidence && active) {
        const required = new Set(active.content.evidence.flatMap((item) => item.sourceIds));
        for (const source of await reportSources(database, active.captureId, active.revision)) {
          if (!required.has(source.id)) continue;
          const duplicateIndex = sourceInputs.findIndex((candidate) => candidate.id === source.id || candidate.url === source.url);
          if (duplicateIndex >= 0) sourceInputs.splice(duplicateIndex, 1);
          sourceInputs.push({ ...source, reportRevision: 0 });
        }
      }
      validateReport(merged.content, merged.provenance, sourceInputs);

      const latest = await database.getFirstAsync<{ revision: number }>(
        'SELECT MAX(revision) AS revision FROM reports WHERE capture_id = ?',
        [input.captureId],
      );
      const revision = (latest?.revision ?? 0) + 1;
      await database.runAsync(
        `INSERT INTO reports (
          capture_id, generation, revision, request_id, phase, origin, supersedes_revision, transcript_revision,
          content_json, provenance_json, provider_id, model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.captureId, input.expectedGeneration, revision, input.requestId, input.phase, input.origin, input.expectedActiveRevision,
          input.transcriptRevision, json(merged.content), json(merged.provenance), input.providerId, input.model, input.createdAt],
      );
      for (const source of sourceInputs) {
        await database.runAsync(
          `INSERT INTO sources (
            capture_id, report_revision, id, title, url, domain, published_at, accessed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.captureId, revision, source.id, source.title, source.url, source.domain, source.publishedAt, source.accessedAt],
        );
      }
      if (input.phase === 'final') {
        await database.runAsync(
          `UPDATE captures SET
            active_report_revision = ?, title = COALESCE(?, title), summary = COALESCE(?, summary),
            kind = COALESCE(?, kind), status = COALESCE(?, status), error_json = NULL, updated_at = ?
           WHERE id = ?`,
          [revision, input.captureUpdate?.title ?? null, input.captureUpdate?.summary ?? null,
            input.captureUpdate?.kind ?? null, input.captureUpdate?.status ?? null,
            input.captureUpdate?.updatedAt ?? input.createdAt, input.captureId],
        );
      }
      return (await getReport(database, input.captureId, revision))!;
    });
  }
}

class SqliteMessageRepository implements MessageRepository {
  constructor(private readonly store: SqliteStore) {}

  async list(captureId: string, limit: number, before: string | null) {
    if (before) requireUtc(before);
    const rows = await this.store.read((database) => database.getAllAsync<MessageRow>(
      `SELECT * FROM messages WHERE capture_id = ? AND (? IS NULL OR created_at < ?)
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      [captureId, before, before, Math.max(0, limit)],
    ));
    return rows.reverse().map(mapMessage);
  }

  appendUser(input: AppendUserMessageInput) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existing = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND client_request_id = ? AND role = 'user'`,
        [input.captureId, input.clientRequestId],
      );
      if (existing) {
        if (existing.generation !== input.expectedGeneration || existing.content !== input.content) {
          throw domainError('conflict', 'database', 'This discussion request already contains another message.');
        }
        return mapMessage(existing);
      }
      const capture = await getCapture(database, input.captureId);
      if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
      if (capture.generation !== input.expectedGeneration) throw domainError('cancelled', 'database', 'The discussion belongs to data that was deleted.');
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'user', ?, 'complete', ?, NULL, ?, 0, NULL, NULL, ?, ?)`,
        [input.id, input.captureId, input.expectedGeneration, input.content, input.clientRequestId,
          capture.activeReportRevision, input.createdAt, input.createdAt],
      );
      return mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [input.id]))!);
    });
  }

  appendUserAndStartAssistant(input: AppendUserMessageInput & Readonly<{ assistantId: string }>) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existingUser = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND client_request_id = ? AND role = 'user'`,
        [input.captureId, input.clientRequestId],
      );
      let user: MessageRecord;
      if (existingUser) {
        if (existingUser.generation !== input.expectedGeneration || existingUser.content !== input.content) {
          throw domainError('conflict', 'database', 'This discussion request already contains another message.');
        }
        user = mapMessage(existingUser);
      } else {
        const capture = await getCapture(database, input.captureId);
        if (!capture) throw domainError('not-found', 'database', 'The capture was deleted.');
        if (capture.generation !== input.expectedGeneration) {
          throw domainError('cancelled', 'database', 'The discussion belongs to data that was deleted.');
        }
        await database.runAsync(
          `INSERT INTO messages (
            id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
            report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
          ) VALUES (?, ?, ?, 'user', ?, 'complete', ?, NULL, ?, 0, NULL, NULL, ?, ?)`,
          [input.id, input.captureId, input.expectedGeneration, input.content, input.clientRequestId,
            capture.activeReportRevision, input.createdAt, input.createdAt],
        );
        user = mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [input.id]))!);
      }

      const existingAssistant = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND reply_to_message_id = ? AND role = 'assistant'`,
        [input.captureId, user.id],
      );
      if (existingAssistant) {
        if (existingAssistant.generation !== input.expectedGeneration
          || existingAssistant.client_request_id !== input.clientRequestId) {
          throw domainError('conflict', 'database', 'This user message already has another response request.');
        }
        return { user, assistant: mapMessage(existingAssistant) };
      }

      const assistantIdCollision = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM messages WHERE id = ?',
        [input.assistantId],
      );
      if (assistantIdCollision) {
        throw domainError('conflict', 'database', 'The assistant message ID is already in use.');
      }
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'assistant', '', 'streaming', ?, ?, ?, 0, NULL, NULL, ?, ?)`,
        [input.assistantId, input.captureId, input.expectedGeneration, input.clientRequestId, user.id,
          user.reportRevision, input.createdAt, input.createdAt],
      );
      return { user, assistant: mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [input.assistantId]))!) };
    });
  }

  startAssistant(input: Parameters<MessageRepository['startAssistant']>[0]) {
    requireUtc(input.createdAt);
    requireGeneration(input.expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, input.expectedGeneration);
      const existing = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE capture_id = ? AND reply_to_message_id = ? AND role = 'assistant'`,
        [input.captureId, input.replyToMessageId],
      );
      if (existing) {
        if (existing.generation !== input.expectedGeneration || existing.client_request_id !== input.clientRequestId) {
          throw domainError('conflict', 'database', 'This user message already has another response request.');
        }
        return mapMessage(existing);
      }
      const parent = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND capture_id = ? AND role = 'user'`,
        [input.replyToMessageId, input.captureId],
      );
      if (!parent) throw domainError('not-found', 'database', 'The user message was not found.');
      if (parent.generation !== input.expectedGeneration) throw domainError('cancelled', 'database', 'The discussion belongs to data that was deleted.');
      await database.runAsync(
        `INSERT INTO messages (
          id, capture_id, generation, role, content, status, client_request_id, reply_to_message_id,
          report_revision, last_sequence, proposal_json, error_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'assistant', '', 'streaming', ?, ?, ?, 0, NULL, NULL, ?, ?)`,
        [input.id, input.captureId, input.expectedGeneration, input.clientRequestId, input.replyToMessageId,
          parent.report_revision, input.createdAt, input.createdAt],
      );
      return mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [input.id]))!);
    });
  }

  appendAssistantDelta(id: string, expectedGeneration: DataGeneration, nextSequence: number, delta: string, updatedAt: string) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const row = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND role = 'assistant'`,
        [id],
      );
      if (!row) throw domainError('not-found', 'database', 'The assistant message was not found.');
      if (row.generation !== expectedGeneration) throw domainError('cancelled', 'database', 'The discussion belongs to data that was deleted.');
      if (nextSequence <= row.last_sequence) return mapMessage(row);
      if (nextSequence !== row.last_sequence + 1 || !['queued', 'streaming'].includes(row.status)) {
        throw domainError('conflict', 'database', 'The streamed response arrived out of order.');
      }
      await database.runAsync(
        `UPDATE messages SET content = content || ?, status = 'streaming', last_sequence = ?, updated_at = ?
         WHERE id = ? AND generation = ?`,
        [delta, nextSequence, updatedAt, id, expectedGeneration],
      );
      return mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]))!);
    });
  }

  retryAssistant(id: string, expectedGeneration: DataGeneration, mode: 'restart' | 'resume', updatedAt: string) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    if (mode !== 'restart' && mode !== 'resume') {
      throw domainError('conflict', 'database', 'The assistant retry mode is invalid.');
    }
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        `UPDATE messages SET
          content = CASE WHEN ? = 'restart' THEN '' ELSE content END,
          last_sequence = CASE WHEN ? = 'restart' THEN 0 ELSE last_sequence END,
          status = 'streaming', proposal_json = NULL, error_json = NULL, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ? AND status IN ('interrupted', 'failed')`,
        [mode, mode, updatedAt, id, expectedGeneration],
      );
      if (result.changes === 0) {
        const message = await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
        if (!message) throw domainError('not-found', 'database', 'The assistant message was not found.');
        throw domainError('conflict', 'database', 'Only an interrupted or failed response can be retried.');
      }
      return mapMessage((await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]))!);
    });
  }

  finishAssistant(
    id: string,
    expectedGeneration: DataGeneration,
    proposal: MessageRecord['reportUpdateProposal'],
    updatedAt: string,
  ) {
    requireUtc(updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const message = await database.getFirstAsync<MessageRow>(
        `SELECT * FROM messages WHERE id = ? AND role = 'assistant'`,
        [id],
      );
      if (!message) throw domainError('not-found', 'database', 'The assistant message was not found.');
      if (message.generation !== expectedGeneration) throw domainError('cancelled', 'database', 'The discussion belongs to data that was deleted.');
      if (proposal && (proposal.captureId !== message.capture_id || proposal.baseRevision !== message.report_revision)) {
        throw domainError('invalid-provider-output', 'database', 'The report proposal does not match this discussion.');
      }
      if (message.status === 'complete') {
        if (message.proposal_json !== (proposal ? json(proposal) : null)) {
          throw domainError('conflict', 'database', 'The completed response cannot be replaced.');
        }
        return;
      }
      if (message.status === 'failed') {
        throw domainError('conflict', 'database', 'A failed response cannot be completed.');
      }
      const result = await database.runAsync(
        `UPDATE messages SET status = 'complete', proposal_json = ?, error_json = NULL, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ?`,
        [proposal ? json(proposal) : null, updatedAt, id, expectedGeneration],
      );
      requireChanged(result, 'The assistant message was not found.');
    });
  }

  interruptAssistant(id: string, expectedGeneration: DataGeneration, error: NormalizedError, updatedAt: string) {
    requireUtc(error.occurredAt, updatedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const result = await database.runAsync(
        `UPDATE messages SET status = 'interrupted', error_json = ?, updated_at = ?
         WHERE id = ? AND role = 'assistant' AND generation = ? AND status IN ('queued', 'streaming', 'interrupted')`,
        [json(error), updatedAt, id, expectedGeneration],
      );
      if (result.changes === 0) {
        const message = await database.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
        if (message?.status === 'complete') return;
        requireChanged(result, 'The assistant message was not found.');
      }
    });
  }
}

class SqliteDiscussionDraftRepository implements DiscussionDraftRepository {
  constructor(private readonly store: SqliteStore) {}

  async get(captureId: string) {
    const row = await this.store.read((database) => database.getFirstAsync<{ capture_id: string; generation: number; content: string; updated_at: string }>(
      'SELECT * FROM discussion_drafts WHERE capture_id = ?',
      [captureId],
    ));
    return row ? { captureId: row.capture_id, generation: row.generation, content: row.content, updatedAt: row.updated_at } : null;
  }

  save(draft: DiscussionDraftRecord) {
    requireUtc(draft.updatedAt);
    requireGeneration(draft.generation);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, draft.generation);
      await database.runAsync(
        `INSERT INTO discussion_drafts (capture_id, generation, content, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(capture_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
         WHERE discussion_drafts.generation = excluded.generation`,
        [draft.captureId, draft.generation, draft.content, draft.updatedAt],
      );
    });
  }

  delete(captureId: string, expectedGeneration: DataGeneration) {
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        'DELETE FROM discussion_drafts WHERE capture_id = ? AND generation = ?',
        [captureId, expectedGeneration],
      );
    });
  }
}

class SqlitePreferencesRepository implements PreferencesRepository {
  constructor(private readonly store: SqliteStore) {}

  async get() {
    const row = await this.store.read((database) => database.getFirstAsync<{ value_json: string }>(
      `SELECT value_json FROM preferences WHERE id = 'app'`,
    ));
    return row ? JSON.parse(row.value_json) as AppPreferencesRecord : defaultPreferences;
  }

  save(preferences: AppPreferencesRecord) {
    requireUtc(preferences.updatedAt);
    if (preferences.researchConsent.decidedAt) requireUtc(preferences.researchConsent.decidedAt);
    requireSafeEndpoint(preferences.speechProvider.endpoint);
    requireSafeEndpoint(preferences.aiProvider.endpoint);
    return this.store.write(async (database) => {
      await database.runAsync(
        `INSERT INTO preferences (id, value_json, updated_at) VALUES ('app', ?, ?)
         ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        [json(preferences), preferences.updatedAt],
      );
    });
  }
}

export class SqliteJobRepository implements JobRepositoryContract {
  constructor(private readonly store: SqliteStore) {}

  enqueue(input: JobEnqueueInput) {
    return this.store.write((database) => insertJob(database, input));
  }

  async get(id: string) {
    const row = await this.store.read((database) => database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]));
    return row ? mapJob(row) : null;
  }

  async listForCapture(captureId: string) {
    const rows = await this.store.read((database) => database.getAllAsync<JobRow>(
      'SELECT * FROM jobs WHERE capture_id = ? ORDER BY created_at, revision',
      [captureId],
    ));
    return rows.map(mapJob);
  }

  claimNext(now: string, leaseUntil: string) {
    requireUtc(now, leaseUntil);
    return this.store.write(async (database) => {
      const candidate = await database.getFirstAsync<JobRow>(
        `SELECT * FROM jobs
         WHERE status IN ('queued', 'retry-wait') AND run_after <= ? AND attempts < max_attempts
         ORDER BY run_after, created_at, id LIMIT 1`,
        [now],
      );
      if (!candidate) return null;
      const result = await database.runAsync(
        `UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_expires_at = ?, updated_at = ?
         WHERE id = ? AND status IN ('queued', 'retry-wait') AND attempts < max_attempts`,
        [leaseUntil, now, candidate.id],
      );
      if (result.changes === 0) return null;
      return mapJob((await database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [candidate.id]))!);
    });
  }

  succeed(id: string, expectedGeneration: DataGeneration, completedAt: string) {
    requireUtc(completedAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'succeeded', lease_expires_at = NULL, last_error_json = NULL,
         completed_at = ?, updated_at = ? WHERE id = ? AND generation = ? AND status = 'running'`,
        [completedAt, completedAt, id, expectedGeneration],
      );
    });
  }

  retry(id: string, expectedGeneration: DataGeneration, runAfter: string, error: NormalizedError) {
    requireUtc(runAfter, error.occurredAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      const job = await database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!job || job.generation !== expectedGeneration || job.status === 'cancelled' || job.status === 'succeeded') return;
      const exhausted = job.attempts >= job.max_attempts;
      await database.runAsync(
        `UPDATE jobs SET status = ?, run_after = ?, lease_expires_at = NULL, last_error_json = ?,
         completed_at = ?, updated_at = ? WHERE id = ?`,
        [exhausted ? 'failed' : 'retry-wait', runAfter, json(error), exhausted ? error.occurredAt : null,
          error.occurredAt, id],
      );
    });
  }

  fail(id: string, expectedGeneration: DataGeneration, failedAt: string, error: NormalizedError) {
    requireUtc(failedAt, error.occurredAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'failed', lease_expires_at = NULL, last_error_json = ?,
         completed_at = ?, updated_at = ? WHERE id = ? AND generation = ? AND status != 'cancelled'`,
        [json(error), failedAt, failedAt, id, expectedGeneration],
      );
    });
  }

  cancelForCapture(captureId: string, expectedGeneration: DataGeneration, cancelledAt: string) {
    requireUtc(cancelledAt);
    requireGeneration(expectedGeneration);
    return this.store.write(async (database) => {
      await requireCurrentGeneration(database, expectedGeneration);
      await database.runAsync(
        `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
         WHERE capture_id = ? AND generation = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')`,
        [cancelledAt, cancelledAt, captureId, expectedGeneration],
      );
    });
  }

  requeueExpiredLeases(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const exhausted = await database.getAllAsync<{ id: string; capture_id: string; generation: number; kind: JobRecord['kind'] }>(
        `SELECT id, capture_id, generation, kind FROM jobs
         WHERE status = 'running' AND lease_expires_at <= ? AND attempts >= max_attempts`,
        [now],
      );
      const staleError = (kind: JobRecord['kind']): NormalizedError => ({
        code: 'timeout',
        operation: kind === 'transcribe-capture' ? 'transcription' : 'report-generation',
        message: 'Processing stopped before this job completed.',
        retryable: false,
        occurredAt: now,
        providerId: null,
        statusCode: null,
      });
      await database.runAsync(
        `UPDATE jobs SET
          status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
          run_after = CASE WHEN attempts >= max_attempts THEN run_after ELSE ? END,
          lease_expires_at = NULL,
          last_error_json = CASE
            WHEN attempts >= max_attempts AND kind = 'transcribe-capture' THEN ?
            WHEN attempts >= max_attempts THEN ?
            ELSE last_error_json
          END,
          completed_at = CASE WHEN attempts >= max_attempts THEN ? ELSE NULL END,
          updated_at = ?
         WHERE status = 'running' AND lease_expires_at <= ?`,
        [now, json(staleError('transcribe-capture')), json(staleError('generate-report')), now, now, now],
      );
      for (const job of exhausted) {
        await database.runAsync(
          `UPDATE captures SET status = 'failed', error_json = ?, updated_at = ? WHERE id = ? AND generation = ?`,
          [json(staleError(job.kind)), now, job.capture_id, job.generation],
        );
      }
      if (!exhausted.length) return [];
      const rows = await database.getAllAsync<JobRow>(
        `SELECT * FROM jobs WHERE id IN (${exhausted.map(() => '?').join(', ')})`,
        exhausted.map((job) => job.id),
      );
      return rows.map(mapJob);
    });
  }
}

const maxCleanupAttempts = CLEANUP_RULES.maxAttempts;

async function insertCleanup(database: SQLiteDatabase, record: CleanupQueueRecord) {
  requireUtc(record.runAfter, record.createdAt, record.updatedAt);
  await database.runAsync(
    `INSERT INTO cleanup_queue (
      id, operation_id, kind, uri, status, attempts, run_after, last_error_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(operation_id, uri) DO NOTHING`,
    [record.id, record.operationId, record.kind, record.uri, record.status, record.attempts,
      record.runAfter, record.lastError ? json(record.lastError) : null, record.createdAt, record.updatedAt],
  );
  const row = await database.getFirstAsync<CleanupRow>(
    'SELECT * FROM cleanup_queue WHERE operation_id = ? AND uri = ?',
    [record.operationId, record.uri],
  );
  if (!row) throw domainError('storage-failed', 'database', 'Audio cleanup could not be queued.', true);
  return mapCleanup(row);
}

export class SqliteCleanupQueueRepository implements CleanupQueueRepository {
  constructor(private readonly store: SqliteStore) {}

  enqueue(record: CleanupQueueRecord) {
    return this.store.write((database) => insertCleanup(database, record));
  }

  claimNext(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const row = await database.getFirstAsync<CleanupRow>(
        `SELECT * FROM cleanup_queue
         WHERE status IN ('pending', 'retry-wait') AND run_after <= ? AND attempts < ?
         ORDER BY run_after, created_at, id LIMIT 1`,
        [now, maxCleanupAttempts],
      );
      if (!row) return null;
      await database.runAsync(
        `UPDATE cleanup_queue SET status = 'running', attempts = attempts + 1, updated_at = ?
         WHERE id = ? AND status IN ('pending', 'retry-wait')`,
        [now, row.id],
      );
      const claimed = await database.getFirstAsync<CleanupRow>('SELECT * FROM cleanup_queue WHERE id = ?', [row.id]);
      return claimed ? mapCleanup(claimed) : null;
    });
  }

  complete(id: string) {
    return this.store.write(async (database) => { await database.runAsync('DELETE FROM cleanup_queue WHERE id = ?', [id]); });
  }

  retry(id: string, runAfter: string, error: NormalizedError) {
    requireUtc(runAfter, error.occurredAt);
    return this.store.write(async (database) => {
      const row = await database.getFirstAsync<CleanupRow>('SELECT * FROM cleanup_queue WHERE id = ?', [id]);
      if (!row) return;
      await database.runAsync(
        `UPDATE cleanup_queue SET status = ?, run_after = ?, last_error_json = ?, updated_at = ? WHERE id = ?`,
        [row.attempts >= maxCleanupAttempts ? 'failed' : 'retry-wait', runAfter, json(error), error.occurredAt, id],
      );
    });
  }

  fail(id: string, error: NormalizedError) {
    requireUtc(error.occurredAt);
    return this.store.write(async (database) => {
      await database.runAsync(
        `UPDATE cleanup_queue SET status = 'failed', last_error_json = ?, updated_at = ? WHERE id = ?`,
        [json(error), error.occurredAt, id],
      );
    });
  }

  requeueFailed(operationId: string, runAfter: string) {
    requireUtc(runAfter);
    return this.store.write(async (database) => {
      const result = await database.runAsync(
        `UPDATE cleanup_queue SET status = 'pending', run_after = ?, updated_at = ?
         WHERE operation_id = ? AND status = 'failed' AND attempts < ?`,
        [runAfter, runAfter, operationId, maxCleanupAttempts],
      );
      return result.changes;
    });
  }

  async listForOperation(operationId: string) {
    const rows = await this.store.read((database) => database.getAllAsync<CleanupRow>(
      'SELECT * FROM cleanup_queue WHERE operation_id = ? ORDER BY created_at, id',
      [operationId],
    ));
    return rows.map(mapCleanup);
  }

  requeueRunning(now: string) {
    requireUtc(now);
    return this.store.write(async (database) => {
      const exhaustedError: NormalizedError = {
        code: 'timeout',
        operation: 'file-cleanup',
        message: 'File cleanup stopped before this item completed.',
        retryable: false,
        occurredAt: now,
        providerId: null,
        statusCode: null,
      };
      const result = await database.runAsync(
        `UPDATE cleanup_queue SET
           status = CASE WHEN attempts >= ? THEN 'failed' ELSE 'pending' END,
           run_after = ?,
           last_error_json = CASE WHEN attempts >= ? THEN ? ELSE last_error_json END,
           updated_at = ?
         WHERE status = 'running'`,
        [maxCleanupAttempts, now, maxCleanupAttempts, json(exhaustedError), now],
      );
      return result.changes;
    });
  }
}

type TombstoneRow = {
  operation_id: string;
  target_kind: DeletionRequest['target']['kind'];
  capture_id: string | null;
  generation: number;
  secure_data: DeletionReceipt['secureData'];
  created_at: string;
};

function mapTarget(row: TombstoneRow): DeletionRequest['target'] {
  return row.target_kind === 'capture'
    ? { kind: 'capture', captureId: row.capture_id! }
    : { kind: row.target_kind };
}

function mapTombstone(row: TombstoneRow): DeletionTombstoneRecord {
  return { operationId: row.operation_id, target: mapTarget(row), generation: row.generation, createdAt: row.created_at };
}

async function deletionReceipt(database: SQLiteDatabase, operationId: string): Promise<DeletionReceipt | null> {
  const tombstone = await database.getFirstAsync<TombstoneRow>(
    'SELECT * FROM deletion_tombstones WHERE operation_id = ?',
    [operationId],
  );
  if (!tombstone) return null;
  const cleanup = await database.getAllAsync<CleanupRow>(
    'SELECT * FROM cleanup_queue WHERE operation_id = ? ORDER BY created_at, id',
    [operationId],
  );
  return {
    operationId,
    target: mapTarget(tombstone),
    structuredDataDeleted: true,
    secureData: tombstone.secure_data,
    pendingAudioUris: cleanup.filter((row) => row.status !== 'failed').map((row) => row.uri),
    failedAudioUris: cleanup.flatMap((row) => {
      const error = parse<NormalizedError>(row.last_error_json);
      return row.status === 'failed' && error ? [{ uri: row.uri, error }] : [];
    }),
  };
}

async function audioUris(database: SQLiteDatabase, captureId?: string, additionalAudioUris: readonly string[] = []) {
  const captureRows = await database.getAllAsync<{ audio_json: string | null }>(
    captureId ? 'SELECT audio_json FROM captures WHERE id = ?' : 'SELECT audio_json FROM captures',
    captureId ? [captureId] : [],
  );
  const draftRows = captureId ? [] : await database.getAllAsync<{ audio_json: string | null }>(
    'SELECT audio_json FROM recording_drafts',
  );
  const queuedRows = captureId ? [] : await database.getAllAsync<{ uri: string }>('SELECT uri FROM cleanup_queue');
  return [...new Set([
    ...additionalAudioUris,
    ...[...captureRows, ...draftRows].flatMap((row) => {
      const audio = parse<{ uri: string }>(row.audio_json);
      return audio?.uri ? [audio.uri] : [];
    }),
    ...queuedRows.map((row) => row.uri),
  ])];
}

export class SqliteDeletionRepository implements DeletionRepository {
  constructor(private readonly store: SqliteStore) {}

  getGeneration() {
    return this.store.read((database) => currentGeneration(database));
  }

  async getTombstone(operationId: string) {
    const row = await this.store.read((database) => database.getFirstAsync<TombstoneRow>(
      'SELECT * FROM deletion_tombstones WHERE operation_id = ?',
      [operationId],
    ));
    return row ? mapTombstone(row) : null;
  }

  stage(request: DeletionRequest, additionalAudioUris: readonly string[] = []) {
    requireUtc(request.requestedAt);
    return this.store.write(async (database) => {
      const existing = await deletionReceipt(database, request.operationId);
      if (existing) {
        if (json(existing.target) !== json(request.target)) {
          throw domainError('conflict', 'database', 'This deletion operation already has another target.');
        }
        return existing;
      }
      const uris = await audioUris(
        database,
        request.target.kind === 'capture' ? request.target.captureId : undefined,
        additionalAudioUris,
      );
      const generation = await currentGeneration(database);
      const nextGeneration = request.target.kind === 'capture' ? generation : generation + 1;
      if (request.target.kind === 'full-reset') {
        await database.runAsync('DELETE FROM cleanup_queue');
      }
      await database.runAsync(
        `INSERT INTO deletion_tombstones (
          operation_id, target_kind, capture_id, generation, secure_data, created_at
        ) VALUES (?, ?, ?, ?, 'not-applicable', ?)`,
        [request.operationId, request.target.kind,
          request.target.kind === 'capture' ? request.target.captureId : null, nextGeneration, request.requestedAt],
      );
      for (const uri of uris) {
        await insertCleanup(database, {
          id: `cleanup:${json([request.operationId, uri])}`,
          operationId: request.operationId,
          kind: 'delete-audio',
          uri,
          status: 'pending',
          attempts: 0,
          runAfter: request.requestedAt,
          lastError: null,
          createdAt: request.requestedAt,
          updatedAt: request.requestedAt,
        });
      }
      if (request.target.kind === 'capture') {
        await database.runAsync(
          `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
           WHERE capture_id = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')`,
          [request.requestedAt, request.requestedAt, request.target.captureId],
        );
        await database.runAsync('DELETE FROM captures WHERE id = ?', [request.target.captureId]);
      } else {
        await database.runAsync(
          `UPDATE jobs SET status = 'cancelled', lease_expires_at = NULL, completed_at = ?, updated_at = ?
           WHERE status NOT IN ('succeeded', 'failed', 'cancelled')`,
          [request.requestedAt, request.requestedAt],
        );
        await database.runAsync('DELETE FROM captures');
        await database.runAsync('DELETE FROM recording_drafts');
        if (request.target.kind === 'full-reset') await database.runAsync('DELETE FROM preferences');
      }
      // Keep the old generation visible until cascades/cancellations finish;
      // the transaction makes the increment and deletion one atomic barrier.
      if (nextGeneration !== generation) {
        await database.runAsync('UPDATE data_generation SET generation = ? WHERE id = 1', [nextGeneration]);
      }
      return (await deletionReceipt(database, request.operationId))!;
    });
  }

  receipt(operationId: string) {
    return this.store.read((database) => deletionReceipt(database, operationId));
  }

  setSecureData(operationId: string, secureData: 'deleted' | 'failed', updatedAt: string) {
    requireUtc(updatedAt);
    return this.store.write(async (database) => {
      await database.runAsync(
        `UPDATE deletion_tombstones SET secure_data = ? WHERE operation_id = ? AND target_kind = 'full-reset'`,
        [secureData, operationId],
      );
    });
  }
}

class SqliteExportSnapshotRepository implements ExportSnapshotRepository {
  constructor(private readonly store: SqliteStore) {}

  readNonSecretBundle(exportedAt: string) {
    requireUtc(exportedAt);
    return this.store.readSnapshot(async (database): Promise<NonSecretExportBundle> => {
      const preferenceRow = await database.getFirstAsync<{ value_json: string }>(
        `SELECT value_json FROM preferences WHERE id = 'app'`,
      );
      const preferences = preferenceRow ? JSON.parse(preferenceRow.value_json) as AppPreferencesRecord : defaultPreferences;
      const captures = (await database.getAllAsync<CaptureRow>('SELECT * FROM captures ORDER BY created_at, id')).map(mapCapture);
      const reports = (await database.getAllAsync<ReportRow>('SELECT * FROM reports ORDER BY capture_id, revision')).map(mapReport);
      const sources = (await database.getAllAsync<SourceRow>('SELECT * FROM sources ORDER BY capture_id, report_revision, id')).map(mapSource);
      const messages = (await database.getAllAsync<MessageRow>('SELECT * FROM messages ORDER BY capture_id, created_at, id')).map(mapMessage);
      const jobs = (await database.getAllAsync<JobRow>('SELECT * FROM jobs ORDER BY created_at, id')).map(mapJob);
      const exportedCaptures: ExportCapture[] = captures.map((capture) => {
        const { audio, generation: _generation, ...safeCapture } = capture;
        return {
          capture: { ...safeCapture, hasSourceAudio: audio !== null },
          reports: reports.filter((report) => report.captureId === capture.id),
          sources: sources.filter((source) => source.captureId === capture.id),
          messages: messages.filter((message) => message.captureId === capture.id),
        };
      });
      const jobHistory: ExportedJobHistory[] = jobs.map((job) => ({
        id: job.id,
        captureId: job.captureId,
        kind: job.kind,
        revision: job.revision,
        requestId: job.requestId,
        status: job.status,
        attempts: job.attempts,
        lastError: job.lastError,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      }));
      return {
        schemaVersion: 1,
        exportedAt,
        preferences: {
          displayName: preferences.displayName,
          languageTag: preferences.languageTag,
          researchEnabled: preferences.researchEnabled,
          researchConsent: preferences.researchConsent,
          notifications: preferences.notifications,
          speechProvider: preferences.speechProvider,
          aiProvider: preferences.aiProvider,
          customSystemPrompt: preferences.customSystemPrompt,
        },
        captures: exportedCaptures,
        jobHistory,
      };
    });
  }
}

export type SqliteRepositories = AppRepositories & Readonly<{
  jobs: SqliteJobRepository;
  cleanup: SqliteCleanupQueueRepository;
  deletions: SqliteDeletionRepository;
}>;

export function createSqliteRepositories(store: SqliteStore): SqliteRepositories {
  return {
    recordingDrafts: new SqliteRecordingDraftRepository(store),
    captures: new SqliteCaptureRepository(store),
    reports: new SqliteReportRepository(store),
    messages: new SqliteMessageRepository(store),
    discussionDrafts: new SqliteDiscussionDraftRepository(store),
    preferences: new SqlitePreferencesRepository(store),
    jobs: new SqliteJobRepository(store),
    cleanup: new SqliteCleanupQueueRepository(store),
    deletions: new SqliteDeletionRepository(store),
    exports: new SqliteExportSnapshotRepository(store),
  };
}
