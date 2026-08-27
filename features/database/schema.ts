import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'hmmmidea.db';
export const SCHEMA_VERSION = 4;

const migration1 = `
CREATE TABLE recording_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  capture_id TEXT NOT NULL UNIQUE,
  recovery_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('recording', 'paused', 'finalizing', 'failed')),
  audio_json TEXT,
  transcript_json TEXT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE captures (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  summary TEXT,
  kind TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'transcribing', 'naming', 'researching', 'ready', 'failed')),
  transcript_json TEXT,
  transcript_text TEXT,
  transcript_phase TEXT CHECK (transcript_phase IN ('provisional', 'final')),
  transcript_revision INTEGER,
  transcript_request_id TEXT,
  audio_json TEXT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
  active_report_revision INTEGER,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (transcript_json IS NULL AND transcript_text IS NULL AND transcript_phase IS NULL AND transcript_revision IS NULL AND transcript_request_id IS NULL)
    OR
    (transcript_json IS NOT NULL AND transcript_text IS NOT NULL AND transcript_phase IS NOT NULL AND transcript_revision >= 1 AND transcript_request_id IS NOT NULL)
  )
);

CREATE TRIGGER recording_draft_identity_is_immutable
BEFORE UPDATE OF capture_id, recovery_id ON recording_drafts
BEGIN
  SELECT RAISE(ABORT, 'recording draft identity is immutable');
END;

CREATE TABLE reports (
  capture_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  request_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('provisional', 'final')),
  origin TEXT NOT NULL CHECK (origin IN ('ai-generated', 'user-edited', 'discussion-update')),
  supersedes_revision INTEGER,
  transcript_revision INTEGER NOT NULL CHECK (transcript_revision >= 1),
  content_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  provider_id TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (capture_id, revision),
  UNIQUE (capture_id, request_id),
  FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE,
  FOREIGN KEY (capture_id, supersedes_revision) REFERENCES reports(capture_id, revision)
);

CREATE TABLE sources (
  capture_id TEXT NOT NULL,
  report_revision INTEGER NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  published_at TEXT,
  accessed_at TEXT NOT NULL,
  PRIMARY KEY (capture_id, report_revision, id),
  UNIQUE (capture_id, report_revision, url),
  FOREIGN KEY (capture_id, report_revision) REFERENCES reports(capture_id, revision) ON DELETE CASCADE
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  capture_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'streaming', 'complete', 'interrupted', 'failed')),
  client_request_id TEXT NOT NULL,
  reply_to_message_id TEXT,
  report_revision INTEGER,
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  proposal_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (capture_id, client_request_id, role),
  FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (capture_id, report_revision) REFERENCES reports(capture_id, revision)
);

CREATE UNIQUE INDEX one_assistant_per_user_message
  ON messages(capture_id, reply_to_message_id)
  WHERE role = 'assistant';

CREATE TABLE discussion_drafts (
  capture_id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY NOT NULL,
  capture_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('transcribe-capture', 'generate-report')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  request_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'retry-wait', 'succeeded', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  run_after TEXT NOT NULL,
  lease_expires_at TEXT,
  last_error_json TEXT,
  payload_json TEXT NOT NULL,
  input_revision INTEGER NOT NULL CHECK (input_revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (capture_id, kind, revision),
  FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
);

CREATE INDEX runnable_jobs ON jobs(status, run_after, created_at);

CREATE TABLE preferences (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'app'),
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deletion_tombstones (
  operation_id TEXT PRIMARY KEY NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('capture', 'all-ideas', 'full-reset')),
  capture_id TEXT,
  secure_data TEXT NOT NULL CHECK (secure_data IN ('not-applicable', 'deleted', 'failed')),
  created_at TEXT NOT NULL,
  CHECK ((target_kind = 'capture' AND capture_id IS NOT NULL) OR (target_kind != 'capture' AND capture_id IS NULL))
);

CREATE TABLE cleanup_queue (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'delete-audio'),
  uri TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'retry-wait', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  run_after TEXT NOT NULL,
  last_error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (operation_id, uri),
  FOREIGN KEY (operation_id) REFERENCES deletion_tombstones(operation_id) ON DELETE CASCADE
);

CREATE INDEX runnable_cleanup ON cleanup_queue(status, run_after, created_at);

CREATE TRIGGER reports_are_immutable
BEFORE UPDATE ON reports
BEGIN
  SELECT RAISE(ABORT, 'immutable report revision');
END;

CREATE TRIGGER report_requires_matching_transcript
BEFORE INSERT ON reports
WHEN NOT EXISTS (
  SELECT 1 FROM captures
  WHERE id = NEW.capture_id
    AND transcript_phase = NEW.phase
    AND transcript_revision = NEW.transcript_revision
)
BEGIN
  SELECT RAISE(ABORT, 'report requires matching transcript');
END;

CREATE TRIGGER sources_are_immutable
BEFORE UPDATE ON sources
BEGIN
  SELECT RAISE(ABORT, 'immutable report source');
END;

CREATE TRIGGER source_insert_requires_https
BEFORE INSERT ON sources
WHEN lower(NEW.url) NOT LIKE 'https://%'
BEGIN
  SELECT RAISE(ABORT, 'source URL must use HTTPS');
END;

CREATE TRIGGER active_report_must_be_final
BEFORE UPDATE OF active_report_revision ON captures
WHEN NEW.active_report_revision IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE capture_id = NEW.id AND revision = NEW.active_report_revision AND phase = 'final'
  )
BEGIN
  SELECT RAISE(ABORT, 'active report must be final');
END;

CREATE TRIGGER new_capture_cannot_reference_report
BEFORE INSERT ON captures
WHEN NEW.active_report_revision IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'new capture cannot reference a report');
END;

CREATE TRIGGER ready_capture_requires_final_report
BEFORE UPDATE OF status, active_report_revision ON captures
WHEN NEW.status = 'ready'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE capture_id = NEW.id AND revision = NEW.active_report_revision AND phase = 'final'
  )
BEGIN
  SELECT RAISE(ABORT, 'ready capture requires final report');
END;

CREATE TRIGGER new_capture_cannot_be_ready
BEFORE INSERT ON captures
WHEN NEW.status = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'new capture cannot be ready');
END;

CREATE TRIGGER report_job_requires_final_transcript
BEFORE INSERT ON jobs
WHEN NEW.kind = 'generate-report'
  AND NOT EXISTS (
    SELECT 1 FROM captures
    WHERE id = NEW.capture_id
      AND transcript_phase = 'final'
      AND transcript_revision = NEW.input_revision
  )
BEGIN
  SELECT RAISE(ABORT, 'report job requires matching final transcript');
END;

CREATE TRIGGER job_identity_is_immutable
BEFORE UPDATE OF capture_id, kind, revision, request_id, payload_json, input_revision ON jobs
BEGIN
  SELECT RAISE(ABORT, 'job identity is immutable');
END;

CREATE TRIGGER tombstoned_capture_cannot_return
BEFORE INSERT ON captures
WHEN EXISTS (
  SELECT 1 FROM deletion_tombstones
  WHERE target_kind = 'capture' AND capture_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'capture is tombstoned');
END;
`;

const migration2 = `
DROP TRIGGER IF EXISTS report_requires_final_transcript;
DROP TRIGGER IF EXISTS report_requires_matching_transcript;

CREATE TRIGGER report_requires_matching_transcript
BEFORE INSERT ON reports
WHEN NOT EXISTS (
  SELECT 1 FROM captures
  WHERE id = NEW.capture_id
    AND transcript_phase = NEW.phase
    AND transcript_revision = NEW.transcript_revision
)
BEGIN
  SELECT RAISE(ABORT, 'report requires matching transcript');
END;
`;

const migration3 = `
DROP TRIGGER IF EXISTS report_job_requires_final_transcript;

CREATE TRIGGER report_job_requires_matching_transcript
BEFORE INSERT ON jobs
WHEN NEW.kind = 'generate-report'
  AND NOT EXISTS (
    SELECT 1 FROM captures
    WHERE id = NEW.capture_id
      AND transcript_revision = NEW.input_revision
  )
BEGIN
  SELECT RAISE(ABORT, 'report job requires matching transcript');
END;
`;

/**
 * A global generation changes only for all-ideas/full-reset. Every durable
 * capture-bound row carries the generation that created it. The generation
 * check is repeated in repository transactions so late provider work cannot
 * write into a capture recreated after a reset.
 */
const migration4 = `
CREATE TABLE IF NOT EXISTS data_generation (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  generation INTEGER NOT NULL CHECK (generation >= 0)
);

INSERT OR IGNORE INTO data_generation (id, generation) VALUES (1, 0);

ALTER TABLE recording_drafts ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE captures ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discussion_drafts ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deletion_tombstones ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER recording_draft_generation_is_current
BEFORE INSERT ON recording_drafts
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'recording draft belongs to a stale data generation');
END;

CREATE TRIGGER recording_draft_update_generation_is_current
BEFORE UPDATE ON recording_drafts
WHEN OLD.generation != (SELECT generation FROM data_generation WHERE id = 1)
  OR NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'recording draft belongs to a stale data generation');
END;

CREATE TRIGGER capture_generation_is_current
BEFORE INSERT ON captures
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'capture belongs to a stale data generation');
END;

CREATE TRIGGER capture_update_generation_is_current
BEFORE UPDATE ON captures
WHEN OLD.generation != (SELECT generation FROM data_generation WHERE id = 1)
  OR NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'capture belongs to a stale data generation');
END;

CREATE TRIGGER report_generation_is_current
BEFORE INSERT ON reports
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'report belongs to a stale data generation');
END;

CREATE TRIGGER message_generation_is_current
BEFORE INSERT ON messages
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'message belongs to a stale data generation');
END;

CREATE TRIGGER message_update_generation_is_current
BEFORE UPDATE ON messages
WHEN OLD.generation != (SELECT generation FROM data_generation WHERE id = 1)
  OR NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'message belongs to a stale data generation');
END;

CREATE TRIGGER discussion_draft_generation_is_current
BEFORE INSERT ON discussion_drafts
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'discussion draft belongs to a stale data generation');
END;

CREATE TRIGGER discussion_draft_update_generation_is_current
BEFORE UPDATE ON discussion_drafts
WHEN OLD.generation != (SELECT generation FROM data_generation WHERE id = 1)
  OR NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'discussion draft belongs to a stale data generation');
END;

CREATE TRIGGER job_generation_is_current
BEFORE INSERT ON jobs
WHEN NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'job belongs to a stale data generation');
END;

CREATE TRIGGER job_update_generation_is_current
BEFORE UPDATE ON jobs
WHEN OLD.generation != (SELECT generation FROM data_generation WHERE id = 1)
  OR NEW.generation != (SELECT generation FROM data_generation WHERE id = 1)
BEGIN
  SELECT RAISE(ABORT, 'job belongs to a stale data generation');
END;
`;

const migrations = [migration1, migration2, migration3, migration4] as const;

export async function migrateDatabase(database: SQLiteDatabase) {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion > SCHEMA_VERSION) throw new Error('Database schema is newer than this app.');

  for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version += 1) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(migrations[version - 1]);
      await database.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
