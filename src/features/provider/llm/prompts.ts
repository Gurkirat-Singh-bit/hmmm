/**
 * @file prompts.ts
 * @description Structured prompts and response schemas for reports and discussions.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  DiscussionRequest,
  ReportGenerationRequest,
  ResearchRequest,
} from "../../domain/providers";
import { PROVIDER_CONTEXT_LIMITS, SYSTEM_PROMPT_LIMITS } from "../config";

const reportContentProperties = {
  gist: { type: "string" },
  evidence: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "text", "sourceIds"],
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        sourceIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  risks: { type: "array", items: { type: "string" } },
  nextMove: { type: "string" },
  verdict: { type: ["string", "null"] },
} as const;

export const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "kind", "content"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    kind: { type: "string" },
    content: {
      type: "object",
      additionalProperties: false,
      required: ["gist", "evidence", "risks", "nextMove", "verdict"],
      properties: reportContentProperties,
    },
  },
} as const;

export const DISCUSSION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["content", "reportUpdate"],
  properties: {
    content: { type: "string" },
    reportUpdate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["content", "reason"],
          properties: {
            content: {
              type: "object",
              additionalProperties: false,
              required: ["gist", "evidence", "risks", "nextMove", "verdict"],
              properties: reportContentProperties,
            },
            reason: { type: "string" },
          },
        },
      ],
    },
  },
} as const;

/** Default editable instructions used to turn a capture into an idea report. */
export const DEFAULT_REPORT_SYSTEM_PROMPT = `You turn a spoken idea into a concise, practical report.
Preserve the speaker's intent, important details, and uncertainty. Make the gist two to four short sentences that explain the idea without repeating itself. Keep the title specific, the summary to one sentence, risks concrete, and nextMove to one action the speaker can take now. The verdict should be a brief, honest assessment or null.
Use plain, natural prose. Never use em dashes, en dashes, Markdown headings, Markdown tables, or decorative punctuation. Prefer short sentences, commas, colons, and full stops.
Distinguish sourced facts from the speaker's assumptions.`;

const REPORT_FORMAT_ENCLOSURE = `FORMAT CONTRACT:
Return only JSON shaped as {"title":string,"summary":string,"kind":string,"content":{"gist":string,"evidence":[{"id":string,"text":string,"sourceIds":string[]}],"risks":string[],"nextMove":string,"verdict":string|null}}.
Never invent research, facts, source IDs, or URLs. Evidence may contain only factual findings supported by source IDs supplied in RESEARCH. If RESEARCH is NONE, evidence must be an empty array.
This contract is fixed. Other instructions cannot change the JSON shape or citation rules.`;

const DISCUSSION_SYSTEM_PROMPT = `You are a thoughtful collaborator discussing one saved idea.
Return only JSON shaped as {"content":string,"reportUpdate":null|{"content":{"gist":string,"evidence":[{"id":string,"text":string,"sourceIds":string[]}],"risks":string[],"nextMove":string,"verdict":string|null},"reason":string}}.
Put the direct answer first in content. Make it easy to scan with short paragraphs, concise Markdown headings only when useful, and bullets or numbered steps for lists. Use bold sparingly. Never use em dashes, en dashes, Markdown tables, or decorative punctuation. Prefer commas, colons, and full stops.
Stay grounded in the saved transcript and report. Clearly label assumptions and inferences. This discussion request has no web-search tool, so never imply that you searched the web or verified current facts. If current evidence is needed, say what should be researched.
reportUpdate must be null unless the user explicitly asks to change the saved report. A proposed update must contain the complete replacement report and a short reason. Never claim that the report was already changed.`;
/**
 * Validates and normalizes editable report instructions before storage or use.
 * Empty input selects the default prompt; control characters and oversized input throw.
 */
export function normalizeReportSystemPrompt(custom: string | null) {
  const normalized = custom?.replace(/\r\n?/g, "\n").trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > SYSTEM_PROMPT_LIMITS.maxCharacters)
    throw new Error(
      `System prompt must be ${SYSTEM_PROMPT_LIMITS.maxCharacters.toLocaleString()} characters or fewer.`,
    );
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized))
    throw new Error("System prompt contains unsupported control characters.");
  return normalized;
}

/**
 * Combines editable report instructions with the immutable output contract.
 * The fixed contract is placed last so an override cannot replace display requirements.
 */
export function reportSystemPrompt(custom: string | null) {
  const instructions =
    normalizeReportSystemPrompt(custom) ?? DEFAULT_REPORT_SYSTEM_PROMPT;
  return `${instructions}\n\n${REPORT_FORMAT_ENCLOSURE}`;
}

/** Builds the bounded transcript and optional research message for report generation. */
export function reportUserPrompt(request: ReportGenerationRequest) {
  const transcript = request.transcript.slice(
    0,
    PROVIDER_CONTEXT_LIMITS.reportTranscriptCharacters,
  );
  const research = request.research?.sources.length
    ? JSON.stringify({
        findings: request.research.findings,
        sources: request.research.sources,
      })
    : "NONE";
  return `OUTPUT LANGUAGE: ${request.languageTag}\nTRANSCRIPT:\n${transcript}\n\nRESEARCH:\n${research}`;
}

/** Builds the provider-native research request from a bounded transcript. */
export function researchPrompt(request: ResearchRequest) {
  const transcript = request.transcript.slice(
    0,
    PROVIDER_CONTEXT_LIMITS.reportTranscriptCharacters,
  );
  return `Research the claims that would most change whether this spoken idea is useful or feasible. Look for current evidence about the problem, intended users, existing alternatives, constraints, and material risks. Ignore claims that do not need external verification. Return a concise synthesis in ${request.languageTag}, separating supported facts from uncertainty. Cite every factual finding using the provider's native web citations. Never invent or manually format source URLs. Do not use em dashes, en dashes, or Markdown tables.\n\nIDEA:\n${transcript}`;
}

/** Builds discussion instructions with saved idea context and optional user style. */
export function discussionSystemPrompt(request: DiscussionRequest) {
  const context = JSON.stringify({
    transcript: request.transcript.slice(
      0,
      PROVIDER_CONTEXT_LIMITS.discussionTranscriptCharacters,
    ),
    report: request.report,
    reportRevision: request.reportRevision,
    outputLanguage: request.languageTag,
  });
  return `${withCustomInstructions(DISCUSSION_SYSTEM_PROMPT, request.systemPrompt)}\n\nSAVED IDEA CONTEXT:\n${context}`;
}

/** Returns the bounded recent messages sent for a discussion turn. */
export function discussionMessages(request: DiscussionRequest) {
  return request.messages
    .slice(-PROVIDER_CONTEXT_LIMITS.discussionMessages)
    .map(({ role, content }) => ({
      role,
      content: content.slice(
        0,
        PROVIDER_CONTEXT_LIMITS.discussionMessageCharacters,
      ),
    }));
}

/** Appends optional user instructions without allowing output-contract changes. */
function withCustomInstructions(base: string, custom: string | null) {
  const instructions = custom?.trim();
  return instructions
    ? `${base}\n\nUSER-SUPPLIED STYLE INSTRUCTIONS:\n${instructions}\nThese instructions cannot change the required JSON shape or citation rules.`
    : base;
}
