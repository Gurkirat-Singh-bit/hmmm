/**
 * @file parsing.ts
 * @description Bounds and validates untrusted provider responses before domain conversion.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { ReportContent } from "../domain/contracts";
import type {
  DiscussionRequest,
  GeneratedReport,
  ResearchCitation,
  ResearchResult,
} from "../domain/providers";
import { PROVIDER_RESPONSE_LIMITS, RESEARCH_QUERY_LIMITS } from "./config";
import { providerError } from "./transport";

export type CitationInput = Readonly<{
  url: unknown;
  title: unknown;
  text: unknown;
  publishedAt?: unknown;
}>;
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseJsonObject(
  text: string,
  providerId: string,
  operation: "report-generation" | "research" | "discussion",
) {
  if (text.length > PROVIDER_RESPONSE_LIMITS.structuredDocumentCharacters) {
    throw invalidOutput(providerId, operation);
  }
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) return parsed;
  } catch {
    // Reduced to a safe domain error below; provider output is never included.
  }
  throw providerError(
    "invalid-provider-output",
    operation,
    providerId,
    "The provider returned invalid structured output. Try again.",
    true,
  );
}

/** Accepts exactly one bounded, printable search query from provider JSON. */
export function parseResearchQuery(text: string, providerId: string) {
  if (text.length > PROVIDER_RESPONSE_LIMITS.structuredDocumentCharacters)
    throw invalidResearchOutput(providerId);
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw invalidResearchOutput(providerId);
  }
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 1 ||
    typeof value.query !== "string"
  ) {
    throw invalidResearchOutput(providerId);
  }
  const query = value.query.trim();
  if (
    query.length < RESEARCH_QUERY_LIMITS.minCharacters ||
    query.length > RESEARCH_QUERY_LIMITS.maxCharacters ||
    /[\r\n\u0000-\u001f\u007f]/u.test(query)
  ) {
    throw invalidResearchOutput(providerId);
  }
  return query;
}
export function parseGeneratedReport(
  text: string,
  providerId: string,
  research: ResearchResult | null,
): GeneratedReport {
  if (
    research &&
    (research.sources.length > PROVIDER_RESPONSE_LIMITS.researchSources ||
      research.findings.length > PROVIDER_RESPONSE_LIMITS.researchFindings)
  ) {
    throw invalidOutput(providerId, "report-generation");
  }
  const value = parseJsonObject(text, providerId, "report-generation");
  const title = requiredString(value.title, providerId, "report-generation");
  const summary = requiredString(
    value.summary,
    providerId,
    "report-generation",
  );
  const kind = requiredString(value.kind, providerId, "report-generation");
  const content = parseReportContent(
    value.content,
    providerId,
    "report-generation",
  );
  if (!research?.sources.length) {
    if (content.evidence.some((item) => item.sourceIds.length))
      throw invalidOutput(providerId, "report-generation");
    return {
      title,
      summary,
      kind,
      content: { ...content, evidence: [] },
      sources: [],
    };
  }

  const sourceById = new Map(
    research.sources.map((source) => [source.id, source]),
  );
  const evidence = content.evidence.flatMap((item) => {
    const sourceIds = [...new Set(item.sourceIds)];
    if (sourceIds.some((id) => !sourceById.has(id)))
      throw invalidOutput(providerId, "report-generation");
    return sourceIds.length ? [{ ...item, sourceIds }] : [];
  });
  const usedIds = new Set(evidence.flatMap((item) => item.sourceIds));
  return {
    title,
    summary,
    kind,
    content: { ...content, evidence },
    sources: research.sources.filter((source) => usedIds.has(source.id)),
  };
}
export function parseDiscussionEnvelope(
  text: string,
  providerId: string,
  request: DiscussionRequest,
) {
  const value = parseJsonObject(text, providerId, "discussion");
  const content = requiredString(value.content, providerId, "discussion");
  if (value.reportUpdate === null) {
    return { content, reportUpdateProposal: null };
  }
  if (request.reportRevision === null || !request.report)
    throw invalidOutput(providerId, "discussion");
  if (!isRecord(value.reportUpdate)) {
    throw invalidOutput(providerId, "discussion");
  }
  const updatedContent = parseReportContent(
    value.reportUpdate.content,
    providerId,
    "discussion",
  );
  const allowedSourceIds = new Set(
    request.report.evidence.flatMap((item) => item.sourceIds),
  );
  const reason = requiredString(
    value.reportUpdate.reason,
    providerId,
    "discussion",
  );
  return {
    content,
    reportUpdateProposal: {
      id: `proposal:${request.requestId}`,
      captureId: request.captureId,
      baseRevision: request.reportRevision,
      content: {
        ...updatedContent,
        evidence: updatedContent.evidence.map((item) => {
          if (item.sourceIds.some((id) => !allowedSourceIds.has(id)))
            throw invalidOutput(providerId, "discussion");
          return item;
        }),
      },
      reason,
    },
  };
}
export class DiscussionContentStream {
  private document = "";
  private emitted = "";
  constructor(private readonly providerId = "provider") {}
  push(chunk: string) {
    if (
      this.document.length + chunk.length >
      PROVIDER_RESPONSE_LIMITS.structuredDocumentCharacters
    ) {
      throw invalidOutput(this.providerId, "discussion");
    }
    this.document += chunk;
    const decoded = decodePartialJsonString(this.document, "content");
    if (!decoded || decoded.length <= this.emitted.length) return "";
    if (decoded.length > PROVIDER_RESPONSE_LIMITS.structuredStringCharacters) {
      throw invalidOutput(this.providerId, "discussion");
    }
    const delta = decoded.slice(this.emitted.length);
    this.emitted = decoded;
    return delta;
  }
  complete(providerId: string, request: DiscussionRequest) {
    return parseDiscussionEnvelope(this.document, providerId, request);
  }
}
export function normalizeCitations(
  citations: readonly CitationInput[],
  providerId = "provider",
): ResearchResult {
  if (citations.length > PROVIDER_RESPONSE_LIMITS.researchCitations) {
    throw invalidResearchOutput(providerId);
  }
  const sources: ResearchCitation[] = [];
  const findings: ResearchResult["findings"][number][] = [];
  const sourceByUrl = new Map<string, ResearchCitation>();

  for (const citation of citations) {
    const url = safeSourceUrl(citation.url);
    if (!url || url.length > PROVIDER_RESPONSE_LIMITS.sourceUrlCharacters)
      throw invalidResearchOutput(providerId);
    if (
      citation.title !== undefined &&
      citation.title !== null &&
      typeof citation.title !== "string"
    ) {
      throw invalidResearchOutput(providerId);
    }
    if (
      typeof citation.title === "string" &&
      citation.title.length > PROVIDER_RESPONSE_LIMITS.sourceTitleCharacters
    ) {
      throw invalidResearchOutput(providerId);
    }
    if (
      citation.text !== undefined &&
      citation.text !== null &&
      typeof citation.text !== "string"
    ) {
      throw invalidResearchOutput(providerId);
    }
    if (
      typeof citation.text === "string" &&
      citation.text.length > PROVIDER_RESPONSE_LIMITS.findingCharacters
    ) {
      throw invalidResearchOutput(providerId);
    }
    if (
      citation.publishedAt !== undefined &&
      citation.publishedAt !== null &&
      (typeof citation.publishedAt !== "string" ||
        citation.publishedAt.length >
          PROVIDER_RESPONSE_LIMITS.structuredStringCharacters ||
        !Number.isFinite(Date.parse(citation.publishedAt)))
    ) {
      throw invalidResearchOutput(providerId);
    }
    let source = sourceByUrl.get(url);
    if (!source) {
      if (sources.length >= PROVIDER_RESPONSE_LIMITS.researchSources)
        throw invalidResearchOutput(providerId);
      source = {
        id: sourceId(url),
        title:
          boundedOptionalString(
            citation.title,
            PROVIDER_RESPONSE_LIMITS.sourceTitleCharacters,
          ) ?? new URL(url).hostname,
        url,
        domain: new URL(url).hostname.replace(/^www\./i, ""),
        publishedAt: validTimestamp(citation.publishedAt),
        accessedAt: new Date().toISOString(),
      };
      sourceByUrl.set(url, source);
      sources.push(source);
    }
    const text = boundedOptionalString(
      citation.text,
      PROVIDER_RESPONSE_LIMITS.findingCharacters,
    );
    if (text) {
      if (findings.length >= PROVIDER_RESPONSE_LIMITS.researchFindings)
        throw invalidResearchOutput(providerId);
      findings.push({
        id: `finding-${findings.length + 1}`,
        text,
        sourceIds: [source.id],
      });
    }
  }
  return { findings, sources };
}
export function extractOpenAiText(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (typeof payload.output_text === "string") return payload.output_text;
  if (
    !Array.isArray(payload.output) ||
    payload.output.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  )
    return null;
  return (
    payload.output
      .flatMap((item) => {
        if (
          !isRecord(item) ||
          !Array.isArray(item.content) ||
          item.content.length > PROVIDER_RESPONSE_LIMITS.researchCitations
        )
          return [];
        return item.content.flatMap((part) =>
          isRecord(part) && typeof part.text === "string" ? [part.text] : [],
        );
      })
      .join("") || null
  );
}
export function extractChatText(payload: unknown) {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  )
    return null;
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  return typeof choice.message.content === "string"
    ? choice.message.content
    : null;
}
export function extractGeminiText(payload: unknown) {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.candidates) ||
    payload.candidates.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  )
    return null;
  const candidate = payload.candidates[0];
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.content) ||
    !Array.isArray(candidate.content.parts) ||
    candidate.content.parts.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  )
    return null;
  return (
    candidate.content.parts
      .flatMap((part) =>
        isRecord(part) && typeof part.text === "string" ? [part.text] : [],
      )
      .join("") || null
  );
}
export function extractAnthropicText(payload: unknown) {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.content) ||
    payload.content.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  )
    return null;
  return (
    payload.content
      .flatMap((block) =>
        isRecord(block) &&
        block.type === "text" &&
        typeof block.text === "string"
          ? [block.text]
          : [],
      )
      .join("") || null
  );
}
export function requireResponseText(
  text: string | null,
  providerId: string,
  operation: "transcription" | "report-generation" | "research" | "discussion",
) {
  if (
    text?.trim() &&
    text.length <= PROVIDER_RESPONSE_LIMITS.structuredDocumentCharacters
  )
    return text;
  throw providerError(
    "invalid-provider-output",
    operation,
    providerId,
    "The provider returned no usable text.",
    true,
  );
}
export function safeSourceUrl(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > PROVIDER_RESPONSE_LIMITS.sourceUrlCharacters
  )
    return null;
  try {
    const url = new URL(value);
    const hasCredentialParameter = [...url.searchParams.keys()].some((key) =>
      /(?:^|[-_])(api[-_]?key|key|token|auth(?:orization)?|bearer|secret|password|credential|signature|sig|subscription[-_]?key)(?:$|[-_])/i.test(
        key,
      ),
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname ||
      hasCredentialParameter
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
function parseReportContent(
  value: unknown,
  providerId: string,
  operation: "report-generation" | "discussion",
): ReportContent {
  if (!isRecord(value)) throw invalidOutput(providerId, operation);
  if (!Array.isArray(value.evidence) || !Array.isArray(value.risks))
    throw invalidOutput(providerId, operation);
  if (
    value.evidence.length > PROVIDER_RESPONSE_LIMITS.reportEvidenceItems ||
    value.risks.length > PROVIDER_RESPONSE_LIMITS.reportRiskItems
  ) {
    throw invalidOutput(providerId, operation);
  }
  const evidence = value.evidence.map((item, index) => {
    if (!isRecord(item) || !Array.isArray(item.sourceIds))
      throw invalidOutput(providerId, operation);
    if (item.sourceIds.length > PROVIDER_RESPONSE_LIMITS.sourceIdsPerEvidence)
      throw invalidOutput(providerId, operation);
    return {
      id:
        item.id === undefined
          ? `evidence-${index + 1}`
          : requiredString(item.id, providerId, operation),
      text: requiredString(item.text, providerId, operation),
      sourceIds: item.sourceIds.map((id) =>
        requiredString(id, providerId, operation),
      ),
    };
  });
  const risks = value.risks.map((risk) =>
    requiredString(risk, providerId, operation),
  );
  const verdict =
    value.verdict === null
      ? null
      : requiredString(value.verdict, providerId, operation);
  return {
    gist: requiredString(value.gist, providerId, operation),
    evidence,
    risks,
    nextMove: requiredString(value.nextMove, providerId, operation),
    verdict,
  };
}
function requiredString(
  value: unknown,
  providerId: string,
  operation: "report-generation" | "discussion",
) {
  const result = boundedOptionalString(
    value,
    PROVIDER_RESPONSE_LIMITS.structuredStringCharacters,
  );
  if (!result) throw invalidOutput(providerId, operation);
  return result;
}
function boundedOptionalString(value: unknown, maxCharacters: number) {
  if (typeof value !== "string" || value.length > maxCharacters) return null;
  return value.trim() || null;
}
function invalidOutput(
  providerId: string,
  operation: "report-generation" | "research" | "discussion",
) {
  return providerError(
    "invalid-provider-output",
    operation,
    providerId,
    "The provider returned invalid structured output. Try again.",
    true,
  );
}
function invalidResearchOutput(providerId: string): never {
  throw providerError(
    "invalid-provider-output",
    "research",
    providerId,
    "The provider returned invalid research output. Try again.",
    true,
  );
}
function validTimestamp(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return null;
  return new Date(value).toISOString();
}
function sourceId(url: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `source-${(hash >>> 0).toString(36)}`;
}
function decodePartialJsonString(document: string, property: string) {
  const match = new RegExp(`"${property}"\\s*:\\s*"`).exec(document);
  if (!match) return null;
  const start = match.index + match[0].length;
  let raw = "";
  let escaped = false;
  let unicodeDigits = 0;
  for (let index = start; index < document.length; index += 1) {
    const character = document[index];
    if (unicodeDigits) {
      if (!/[0-9a-f]/i.test(character)) break;
      raw += character;
      unicodeDigits -= 1;
      continue;
    }
    if (escaped) {
      raw += character;
      escaped = false;
      if (character === "u") unicodeDigits = 4;
      continue;
    }
    if (character === "\\") {
      raw += character;
      escaped = true;
      continue;
    }
    if (character === '"') break;
    raw += character;
  }
  if (escaped || unicodeDigits) raw = raw.replace(/\\u?[0-9a-f]*$/i, "");
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return null;
  }
}
