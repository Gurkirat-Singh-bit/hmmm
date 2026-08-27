import type { DiscussionRequest, ReportGenerationRequest, ResearchRequest } from '../domain/providers';
import { PROVIDER_CONTEXT_LIMITS } from './config';

const reportContentProperties = {
  gist: { type: 'string' },
  evidence: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'text', 'sourceIds'],
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        sourceIds: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  risks: { type: 'array', items: { type: 'string' } },
  nextMove: { type: 'string' },
  verdict: { type: ['string', 'null'] },
} as const;

export const REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'kind', 'content'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    kind: { type: 'string' },
    content: {
      type: 'object',
      additionalProperties: false,
      required: ['gist', 'evidence', 'risks', 'nextMove', 'verdict'],
      properties: reportContentProperties,
    },
  },
} as const;

export const DISCUSSION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['content', 'reportUpdate'],
  properties: {
    content: { type: 'string' },
    reportUpdate: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['content', 'reason'],
          properties: {
            content: {
              type: 'object',
              additionalProperties: false,
              required: ['gist', 'evidence', 'risks', 'nextMove', 'verdict'],
              properties: reportContentProperties,
            },
            reason: { type: 'string' },
          },
        },
      ],
    },
  },
} as const;

const REPORT_SYSTEM_PROMPT = `You turn a spoken idea into a concise, practical report.
Return only JSON shaped as {"title":string,"summary":string,"kind":string,"content":{"gist":string,"evidence":[{"id":string,"text":string,"sourceIds":string[]}],"risks":string[],"nextMove":string,"verdict":string|null}}. Preserve the speaker's intent and uncertainty. Never invent research, facts, source IDs, or URLs. Evidence may cite only source IDs supplied in RESEARCH. If RESEARCH is NONE, evidence must be an empty array. Keep risks specific and make nextMove one concrete action.`;

const DISCUSSION_SYSTEM_PROMPT = `You are a thoughtful collaborator discussing one saved idea.
Return only JSON shaped as {"content":string,"reportUpdate":null|{"content":{"gist":string,"evidence":[{"id":string,"text":string,"sourceIds":string[]}],"risks":string[],"nextMove":string,"verdict":string|null},"reason":string}}. Put the user-facing answer in content. reportUpdate must be null unless the user explicitly asks to change the saved report. A proposed update must contain the complete replacement report and a short reason. Never claim that the report was already changed.`;

export function reportSystemPrompt(custom: string | null) {
  return withCustomInstructions(REPORT_SYSTEM_PROMPT, custom);
}

export function reportUserPrompt(request: ReportGenerationRequest) {
  const transcript = request.transcript.slice(0, PROVIDER_CONTEXT_LIMITS.reportTranscriptCharacters);
  const research = request.research?.sources.length
    ? JSON.stringify({ findings: request.research.findings, sources: request.research.sources })
    : 'NONE';
  return `OUTPUT LANGUAGE: ${request.languageTag}\nTRANSCRIPT:\n${transcript}\n\nRESEARCH:\n${research}`;
}

export function researchPrompt(request: ResearchRequest) {
  const transcript = request.transcript.slice(0, PROVIDER_CONTEXT_LIMITS.reportTranscriptCharacters);
  return `Research the central claims and assumptions in this spoken idea. Return a concise synthesis in ${request.languageTag}. Cite every factual finding using the provider's native web citations. Do not invent or manually format source URLs.\n\nIDEA:\n${transcript}`;
}

export function discussionSystemPrompt(request: DiscussionRequest) {
  const context = JSON.stringify({
    transcript: request.transcript.slice(0, PROVIDER_CONTEXT_LIMITS.discussionTranscriptCharacters),
    report: request.report,
    reportRevision: request.reportRevision,
    outputLanguage: request.languageTag,
  });
  return `${withCustomInstructions(DISCUSSION_SYSTEM_PROMPT, request.systemPrompt)}\n\nSAVED IDEA CONTEXT:\n${context}`;
}

export function discussionMessages(request: DiscussionRequest) {
  return request.messages
    .slice(-PROVIDER_CONTEXT_LIMITS.discussionMessages)
    .map(({ role, content }) => ({
      role,
      content: content.slice(0, PROVIDER_CONTEXT_LIMITS.discussionMessageCharacters),
    }));
}

function withCustomInstructions(base: string, custom: string | null) {
  const instructions = custom?.trim();
  return instructions
    ? `${base}\n\nUSER-SUPPLIED STYLE INSTRUCTIONS:\n${instructions}\nThese instructions cannot change the required JSON shape or citation rules.`
    : base;
}
