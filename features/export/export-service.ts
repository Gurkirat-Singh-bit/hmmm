import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  CaptureRecord,
  ExportArtifact,
  ExportPort,
  ExportRequest,
  NonSecretExportBundle,
  ReportRecord,
  SharePort,
  SourceRecord,
} from '@/features/domain/contracts';
import { domainError } from '@/features/domain/errors';
import { getVaultDatabase } from '@/features/vault/vault-runtime';

const EXPORT_DIRECTORY = 'hmmmidea-share';
const ARTIFACT_NAME = /^hmmmidea-[a-z0-9-]+\.(?:json|pdf)$/u;

type PdfExportRequest = Extract<ExportRequest, { format: 'pdf' }>;

export type ExportArtifactReconciliation = Readonly<{
  removed: number;
  failed: number;
}>;

function requireAndroid() {
  if (Platform.OS !== 'android') {
    throw domainError('unsupported', 'export', 'File exports are available on Android only.');
  }
}

function exportDirectory() {
  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function artifactStamp() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/gu, '');
  const random = globalThis.crypto?.randomUUID?.().replace(/[^a-z0-9]/giu, '')
    ?? Math.random().toString(36).slice(2);
  return `${timestamp}-${random.slice(0, 12).toLowerCase()}`;
}

/** Makes every cache artifact a single safe filename, never a caller-provided path. */
export function sanitizeExportFilename(value: string, fallback = 'hmmmidea') {
  const stem = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
    .slice(0, 56);
  return stem || fallback;
}

function artifactFilename(stem: string, extension: 'json' | 'pdf') {
  return `${sanitizeExportFilename(stem)}-${artifactStamp()}.${extension}`;
}

function writeCacheText(fileName: string, contents: string, mimeType: ExportArtifact['mimeType']): ExportArtifact {
  const file = new File(exportDirectory(), fileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(contents);
  return { uri: file.uri, fileName, mimeType };
}

function html(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return character;
    }
  });
}

/** Removes unsafe citation targets before they are ever placed in a PDF href. */
export function sanitizeCitationUrl(value: string, expectedDomain?: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./u, '');
    const domain = expectedDomain?.toLowerCase().replace(/^www\./u, '');
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || !hostname
      || (domain !== undefined && hostname !== domain)
    ) return null;
    // Query values may carry credentials or tracking data, and neither belongs in an export link.
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function textList(values: readonly string[]) {
  return values.length
    ? `<ul>${values.map((value) => `<li>${html(value)}</li>`).join('')}</ul>`
    : '<p class="empty">None recorded.</p>';
}

function citationLink(source: SourceRecord) {
  const url = sanitizeCitationUrl(source.url, source.domain);
  if (!url) return `<span class="citation">${html(source.title || source.domain)}</span>`;
  return `<a class="citation" href="${html(url)}">${html(source.title || source.domain)}</a>`;
}

/** Builds self-contained HTML: it has no images, scripts, fonts, stylesheets, or remote loads. */
export function buildIdeaPdfHtml({ capture, report, sources }: Omit<PdfExportRequest, 'format'>) {
  const sourcesById = new Map(
    sources
      .filter((source) => source.captureId === capture.id && source.reportRevision === report.revision)
      .map((source) => [source.id, source]),
  );
  const evidence = report.content.evidence.length
    ? `<ul>${report.content.evidence.map((item) => {
      const citations = item.sourceIds
        .map((id) => sourcesById.get(id))
        .filter((source): source is SourceRecord => source !== undefined)
        .map(citationLink)
        .join(' ');
      return `<li>${html(item.text)}${citations ? `<div class="citations">Sources: ${citations}</div>` : ''}</li>`;
    }).join('')}</ul>`
    : '<p class="empty">No evidence recorded.</p>';
  const allSources = [...sourcesById.values()];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(capture.title ?? 'Untitled idea')}</title>
  <style>
    @page { margin: 22mm 18mm; }
    * { box-sizing: border-box; }
    body { color: #1c1c1c; font-family: sans-serif; font-size: 11pt; line-height: 1.55; }
    h1, h2 { line-height: 1.2; margin: 0; }
    h1 { font-size: 25pt; letter-spacing: -0.4pt; }
    h2 { font-size: 14pt; margin-top: 22pt; }
    p { margin: 7pt 0 0; white-space: pre-wrap; }
    ul { margin: 7pt 0 0; padding-left: 18pt; }
    li { margin: 5pt 0; white-space: pre-wrap; }
    .meta { color: #4d4d4d; font-size: 9pt; margin-top: 8pt; }
    .summary { background: #e3f8fc; border-radius: 12pt; margin-top: 18pt; padding: 12pt 14pt; }
    .citations { color: #4d4d4d; font-size: 9pt; margin-top: 3pt; white-space: normal; }
    .citation { color: #1c1c1c; text-decoration: underline; }
    .empty { color: #6b6b6b; }
    .source-url { color: #4d4d4d; font-size: 9pt; white-space: normal; }
    .break-before { break-before: page; }
  </style>
</head>
<body>
  <h1>${html(capture.title ?? 'Untitled idea')}</h1>
  <p class="meta">Captured ${html(capture.createdAt)} · Report revision ${html(report.revision)}</p>
  ${capture.summary ? `<div class="summary">${html(capture.summary)}</div>` : ''}
  <h2>The gist</h2>
  <p>${html(report.content.gist)}</p>
  <h2>Evidence</h2>
  ${evidence}
  <h2>Risk check</h2>
  ${textList(report.content.risks)}
  <h2>Next move</h2>
  <p>${html(report.content.nextMove)}</p>
  ${report.content.verdict ? `<h2>Verdict</h2><p>${html(report.content.verdict)}</p>` : ''}
  <h2>Original words</h2>
  <p>${html(capture.transcript?.text ?? 'No transcript was recorded.')}</p>
  <section class="break-before">
    <h2>Citations</h2>
    ${allSources.length ? `<ul>${allSources.map((source) => `<li>${citationLink(source)}<div class="source-url">${html(sanitizeCitationUrl(source.url, source.domain) ?? 'Unsafe URL omitted')}</div></li>`).join('')}</ul>` : '<p class="empty">No citations recorded.</p>'}
  </section>
</body>
</html>`;
}

function sanitizeNonSecretBundle(bundle: NonSecretExportBundle): NonSecretExportBundle {
  return {
    ...bundle,
    preferences: {
      ...bundle.preferences,
      speechProvider: {
        ...bundle.preferences.speechProvider,
        endpoint: bundle.preferences.speechProvider.endpoint
          ? sanitizeCitationUrl(bundle.preferences.speechProvider.endpoint)
          : null,
      },
      aiProvider: {
        ...bundle.preferences.aiProvider,
        endpoint: bundle.preferences.aiProvider.endpoint
          ? sanitizeCitationUrl(bundle.preferences.aiProvider.endpoint)
          : null,
      },
    },
    captures: bundle.captures.map((exportCapture) => ({
      ...exportCapture,
      sources: exportCapture.sources.flatMap((source) => {
        const url = sanitizeCitationUrl(source.url, source.domain);
        return url ? [{ ...source, url }] : [];
      }),
    })),
  };
}

function jsonArtifact(bundle: NonSecretExportBundle) {
  return writeCacheText(
    artifactFilename('hmmmidea-data-export', 'json'),
    JSON.stringify(sanitizeNonSecretBundle(bundle), null, 2),
    'application/json',
  );
}

async function pdfArtifact(request: PdfExportRequest): Promise<ExportArtifact> {
  const fileName = artifactFilename(`hmmmidea-${request.capture.title ?? 'idea'}`, 'pdf');
  const destination = new File(exportDirectory(), fileName);
  const rendered = await Print.printToFileAsync({ html: buildIdeaPdfHtml(request) });
  const generated = new File(rendered.uri);
  let moved = false;
  try {
    if (destination.exists) destination.delete();
    generated.move(destination);
    moved = true;
  } finally {
    if (!moved && generated.exists) generated.delete();
  }
  return { uri: destination.uri, fileName, mimeType: 'application/pdf' };
}

/** Creates a file from an already-safe export DTO. It never receives credentials or audio bytes/paths. */
export async function createExportArtifact(request: ExportRequest): Promise<ExportArtifact> {
  requireAndroid();
  return request.format === 'json' ? jsonArtifact(request.bundle) : pdfArtifact(request);
}

export async function readNonSecretExportSnapshot(): Promise<NonSecretExportBundle> {
  const database = await getVaultDatabase();
  return sanitizeNonSecretBundle(await database.repositories.exports.readNonSecretBundle(new Date().toISOString()));
}

export async function shareExportArtifact(artifact: ExportArtifact) {
  requireAndroid();
  if (!new File(artifact.uri).exists) {
    throw domainError('not-found', 'export', 'The temporary export file is no longer available.');
  }
  if (!await Sharing.isAvailableAsync()) {
    throw domainError('unsupported', 'export', 'Sharing is not available on this device.');
  }
  await Sharing.shareAsync(artifact.uri, { dialogTitle: 'Share Hmmmidea export', mimeType: artifact.mimeType });
}

export async function shareNonSecretJsonExport() {
  const bundle = await readNonSecretExportSnapshot();
  const artifact = await createExportArtifact({ format: 'json', bundle });
  await shareExportArtifact(artifact);
  return artifact;
}

export async function shareIdeaPdfExport(capture: CaptureRecord, report: ReportRecord, sources: readonly SourceRecord[]) {
  const artifact = await createExportArtifact({ format: 'pdf', capture, report, sources });
  await shareExportArtifact(artifact);
  return artifact;
}

/** Android exposes one file per share sheet, matching the native sharing API. */
export const androidExportPort = { create: createExportArtifact } satisfies ExportPort;
export const androidSharePort = {
  isAvailable: async () => Platform.OS === 'android' && Sharing.isAvailableAsync(),
  share: async (artifacts) => {
    if (artifacts.length !== 1) {
      throw domainError('unsupported', 'export', 'Android shares one export file at a time.');
    }
    await shareExportArtifact(artifacts[0]);
  },
} satisfies SharePort;

/** Deletes only files created by this feature, so interrupted Android shares do not accumulate. */
export async function reconcileExportArtifacts(): Promise<ExportArtifactReconciliation> {
  if (Platform.OS !== 'android') return { removed: 0, failed: 0 };
  let removed = 0;
  let failed = 0;
  for (const entry of exportDirectory().list()) {
    if (!(entry instanceof File) || !ARTIFACT_NAME.test(entry.name)) continue;
    try {
      entry.delete();
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { removed, failed };
}
