import { Linking, Share } from 'react-native';

import { LocalDataDeletion } from '@/features/database/deletion';
import type {
  CaptureId,
  CaptureRecord,
  DataGeneration,
  ReportContent,
  ReportField,
  ReportProvenance,
  ReportRecord,
  ReportRevision,
  ReportUpdateProposal,
  SecretStorePort,
  SourceRecord,
} from '@/features/domain/contracts';
import { domainError } from '@/features/domain/errors';
import { reportJob } from '@/features/jobs/triggers';
import { AppOwnedAudioFiles, isAppOwnedAudioUri } from '@/features/recording/audio-storage';

import { getVaultDatabase } from './vault-runtime';

const reportFields = ['gist', 'evidence', 'risks', 'nextMove', 'verdict'] as const satisfies readonly ReportField[];

function operationId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}:${Date.now()}:${random}`;
}

function sourcesForRevision(sources: readonly SourceRecord[]) {
  return sources.map(({ captureId: _captureId, reportRevision: _reportRevision, ...source }) => source);
}

function changedFields(before: ReportContent, after: ReportContent) {
  return reportFields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

function userProvenance(report: ReportRecord, fields: readonly ReportField[], changedAt: string, origin: 'user-edited' | 'discussion-update'): ReportProvenance {
  const changed = new Set(fields);
  return Object.fromEntries(reportFields.map((field) => [field, changed.has(field)
    ? { owner: 'user' as const, origin, sourceRevision: report.revision, changedAt }
    : report.provenance[field],
  ])) as ReportProvenance;
}

function requireEditable(capture: CaptureRecord | null, report: ReportRecord | null): asserts capture is CaptureRecord {
  if (!capture) {
    throw domainError('not-found', 'report-generation', 'This idea was deleted.');
  }
  if (!report || capture.generation !== report.generation) {
    throw domainError('cancelled', 'report-generation', 'This report is outdated because the idea was deleted or replaced.');
  }
  if (report.phase !== 'final' || capture.activeReportRevision !== report.revision) {
    throw domainError('conflict', 'report-generation', 'Open the active ready report before updating it.');
  }
  if (capture.transcript?.phase !== 'final') {
    throw domainError('conflict', 'report-generation', 'A final transcript is required before updating this report.');
  }
}

/** Adds a user-owned immutable revision. Existing sources are copied for evidence integrity. */
export async function saveManualReport(captureId: CaptureId, report: ReportRecord, content: ReportContent, sources: readonly SourceRecord[]) {
  const database = await getVaultDatabase();
  const capture = await database.repositories.captures.get(captureId);
  requireEditable(capture, report);
  const now = new Date().toISOString();
  const changed = changedFields(report.content, content);
  if (!changed.length) return report;
  return database.repositories.reports.appendRevision({
    captureId,
    expectedGeneration: capture.generation,
    requestId: operationId('manual-report'),
    expectedActiveRevision: report.revision,
    phase: 'final',
    origin: 'user-edited',
    transcriptRevision: capture.transcript!.revision,
    content,
    provenance: userProvenance(report, changed, now, 'user-edited'),
    explicitlyReplacedUserFields: [],
    sources: sourcesForRevision(sources),
    providerId: null,
    model: null,
    captureUpdate: null,
    createdAt: now,
  });
}

/** Accepting a discussion proposal is the explicit write that makes it part of the idea. */
export async function applyDiscussionReportUpdate(
  proposal: ReportUpdateProposal,
  report: ReportRecord,
  sources: readonly SourceRecord[],
  expectedGeneration: DataGeneration,
) {
  if (proposal.captureId !== report.captureId
    || proposal.baseRevision !== report.revision
    || report.generation !== expectedGeneration) {
    throw domainError('conflict', 'discussion', 'The discussion proposal is no longer based on this report.');
  }
  const database = await getVaultDatabase();
  const capture = await database.repositories.captures.get(proposal.captureId);
  if (!capture) {
    throw domainError('not-found', 'discussion', 'This idea was deleted.');
  }
  if (capture.generation !== expectedGeneration) {
    throw domainError('conflict', 'discussion', 'The discussion proposal is no longer based on this idea.');
  }
  requireEditable(capture, report);
  const now = new Date().toISOString();
  return database.repositories.reports.appendRevision({
    captureId: proposal.captureId,
    expectedGeneration,
    requestId: `discussion-update:${proposal.id}`,
    expectedActiveRevision: report.revision,
    phase: 'final',
    origin: 'discussion-update',
    transcriptRevision: capture.transcript!.revision,
    content: proposal.content,
    provenance: userProvenance(report, changedFields(report.content, proposal.content), now, 'discussion-update'),
    explicitlyReplacedUserFields: [],
    sources: sourcesForRevision(sources),
    providerId: null,
    model: null,
    captureUpdate: null,
    createdAt: now,
  });
}

/** Queues a new provider revision. Repository merging preserves user-owned fields by default. */
export async function regenerateReport(
  capture: Pick<CaptureRecord, 'id' | 'generation'>,
  expectedActiveRevision: ReportRevision | null,
  explicitlyReplacedUserFields: readonly ReportField[] = [],
) {
  const database = await getVaultDatabase();
  const [current, preferences, jobs] = await Promise.all([
    database.repositories.captures.get(capture.id),
    database.repositories.preferences.get(),
    database.repositories.jobs.listForCapture(capture.id),
  ]);
  if (!current) throw domainError('not-found', 'report-generation', 'The capture was not found.');
  if (current.generation !== capture.generation) {
    throw domainError('cancelled', 'report-generation', 'This idea was deleted or replaced. Refresh the report.');
  }
  if (current.activeReportRevision !== expectedActiveRevision) {
    throw domainError('conflict', 'report-generation', 'The report changed before regeneration was confirmed. Refresh the idea and review the current revision.');
  }
  if (current.transcript?.phase !== 'final') {
    throw domainError('conflict', 'report-generation', 'A final transcript is required before regenerating this report.');
  }
  const now = new Date().toISOString();
  const nextJobRevision = Math.max(0, ...jobs.map((job) => job.revision)) + 1;
  const job = reportJob({
    captureId: capture.id,
    generation: capture.generation,
    revision: nextJobRevision,
    requestId: operationId('regenerate-report'),
    transcriptRevision: current.transcript.revision,
    expectedActiveRevision,
    researchEnabled: preferences.researchEnabled,
    reason: 'explicit-regenerate',
    explicitlyReplacedUserFields,
    runAfter: now,
    maxAttempts: 3,
  });
  return database.repositories.captures.queueProcessing({
    id: capture.id,
    status: 'queued',
    error: null,
    updatedAt: now,
    expectedGeneration: capture.generation,
    job,
  });
}

export async function setCaptureStarred(capture: Pick<CaptureRecord, 'id' | 'generation'>, starred: boolean) {
  const database = await getVaultDatabase();
  const current = await database.repositories.captures.get(capture.id);
  if (!current) throw domainError('not-found', 'database', 'The capture was not found.');
  if (current.generation !== capture.generation) {
    throw domainError('cancelled', 'database', 'This idea was deleted or replaced. Refresh the Vault.');
  }
  await database.repositories.captures.setStarred(capture.id, starred, new Date().toISOString(), capture.generation);
}

const captureOnlySecrets: SecretStorePort = {
  readActive: async () => null,
  activate: async () => undefined,
  deleteVersion: async () => undefined,
  clear: async () => undefined,
};

/** Capture deletion has no secret side effect; LocalDataDeletion still durably cleans referenced audio. */
export async function deleteCaptures(captures: readonly Pick<CaptureRecord, 'id' | 'generation'>[]) {
  const database = await getVaultDatabase();
  const current = await Promise.all(captures.map((capture) => database.repositories.captures.get(capture.id)));
  if (current.some((capture, index) => !capture || capture.generation !== captures[index].generation)) {
    throw domainError('cancelled', 'database', 'One or more selected ideas were deleted or replaced. Refresh the Vault.');
  }
  const deletion = new LocalDataDeletion({
    deletions: database.repositories.deletions,
    cleanup: database.repositories.cleanup,
    secrets: captureOnlySecrets,
    audioFiles: new AppOwnedAudioFiles(),
    isAppOwnedUri: isAppOwnedAudioUri,
  });
  return Promise.all(captures.map(({ id: captureId }) => deletion.execute({
    operationId: operationId('delete-capture'),
    target: { kind: 'capture', captureId },
    requestedAt: new Date().toISOString(),
  })));
}

function shareText(capture: CaptureRecord, report: ReportRecord | null) {
  const title = capture.title?.trim() || 'Untitled idea';
  const parts = [title];
  if (capture.summary) parts.push(capture.summary);
  if (report) {
    parts.push(`The gist: ${report.content.gist}`);
    parts.push(`Next move: ${report.content.nextMove}`);
  } else if (capture.transcript?.text) {
    parts.push(`Original words: ${capture.transcript.text}`);
  }
  return parts.join('\n\n');
}

/** Text sharing needs no export file and is therefore available before PDF/JSON wiring. */
export async function shareCaptures(captureIds: readonly CaptureId[]) {
  const database = await getVaultDatabase();
  const captures = (await Promise.all(captureIds.map((id) => database.repositories.captures.get(id))))
    .filter((capture): capture is CaptureRecord => capture !== null);
  if (!captures.length) throw domainError('not-found', 'export', 'The selected ideas are no longer in the Vault.');
  const reports = await Promise.all(captures.map((capture) => database.repositories.reports.getActive(capture.id)));
  await Share.share({
    title: captures.length === 1 ? (captures[0].title ?? 'Hmmmidea') : 'Hmmmidea ideas',
    message: captures.map((capture, index) => shareText(capture, reports[index])).join('\n\n────────\n\n'),
  });
}

/** Validate again at the opening boundary, even though SQLite validated the source on insert. */
export async function openCitation(url: string, domain: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw domainError('invalid-url', 'export', 'This source link is not a valid URL.');
  }
  const hasCredentialParameter = [...parsed.searchParams.keys()].some((key) =>
    /(?:^|[-_])(api[-_]?key|key|token|auth(?:orization)?|bearer|secret|password|credential|signature|sig|subscription[-_]?key)(?:$|[-_])/i.test(key),
  );
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const expectedDomain = domain.toLowerCase().replace(/^www\./, '');
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !hostname || hostname !== expectedDomain || hasCredentialParameter) {
    throw domainError('invalid-url', 'export', 'Source links must use credential-free HTTPS.');
  }
  if (!await Linking.canOpenURL(parsed.toString())) {
    throw domainError('unsupported', 'export', 'This device cannot open the source link.');
  }
  await Linking.openURL(parsed.toString());
}
