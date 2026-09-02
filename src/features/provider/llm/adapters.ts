/**
 * @file adapters.ts
 * @description Wire-protocol adapters for report generation, research, and discussion providers.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AiProviderPort,
  DiscussionRequest,
  DiscussionResponse,
  DiscussionStreamEvent,
  ProviderContext,
  ReportGenerationRequest,
  ResearchRequest,
  ResearchResult,
} from "../../domain/providers";
import {
  AI_PROVIDER_DESCRIPTORS,
  PROVIDER_TIMEOUT_MS,
  PROVIDER_RESPONSE_LIMITS,
  supportsProviderResearch,
  type AiProviderId,
} from "../config";
import {
  DiscussionContentStream,
  extractAnthropicText,
  extractChatText,
  extractGeminiText,
  extractOpenAiText,
  isRecord,
  normalizeCitations,
  parseGeneratedReport,
  requireResponseText,
  type CitationInput,
} from "../parsing";
import {
  DISCUSSION_JSON_SCHEMA,
  REPORT_JSON_SCHEMA,
  discussionMessages,
  discussionSystemPrompt,
  reportSystemPrompt,
  reportUserPrompt,
  researchPrompt,
} from "./prompts";
import {
  providerBaseUrl,
  providerError,
  requestHeaders,
  requestJson,
  requireProviderContext,
  streamSse,
} from "../transport";

export const openAiProvider = aiProvider("openai");
export const groqProvider = aiProvider("groq");
export const openRouterProvider = aiProvider("openrouter");
export const googleProvider = aiProvider("google");
export const anthropicProvider = aiProvider("claude");
export const customAiProvider = aiProvider("custom");
function aiProvider(providerId: AiProviderId): AiProviderPort {
  const descriptor = {
    ...AI_PROVIDER_DESCRIPTORS[providerId],
    kind: "ai" as const,
  };
  return {
    descriptor,
    ...(descriptor.capabilities["ai.research-with-citations"]
      ? {
          research: (context: ProviderContext, request: ResearchRequest) =>
            research(providerId, context, request),
        }
      : {}),
    generateReport: (context, request) =>
      generateReport(providerId, context, request),
    completeDiscussion: (context, request) =>
      completeDiscussion(providerId, context, request),
    streamDiscussion: (context, request) =>
      streamDiscussion(providerId, context, request),
  };
}
async function generateReport(
  providerId: AiProviderId,
  context: ProviderContext,
  request: ReportGenerationRequest,
) {
  const { apiKey, model } = requireProviderContext(context, providerId);
  const payload = await requestJson({
    providerId,
    operation: "report-generation",
    url: generationUrl(providerId, context, model, false),
    init: {
      method: "POST",
      headers: requestHeaders(providerId, apiKey, request.requestId),
      body: JSON.stringify(reportBody(providerId, model, request)),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.ai,
  });
  const text = responseText(providerId, payload, "report-generation");
  return parseGeneratedReport(text, providerId, request.research);
}
async function research(
  providerId: AiProviderId,
  context: ProviderContext,
  request: ResearchRequest,
): Promise<ResearchResult> {
  if (providerId === "custom") return { findings: [], sources: [] };
  const { apiKey, model } = requireProviderContext(context, providerId);
  if (!supportsProviderResearch(providerId, model))
    return { findings: [], sources: [] };
  const payload = await requestJson({
    providerId,
    operation: "research",
    url: generationUrl(providerId, context, model, false),
    init: {
      method: "POST",
      headers: requestHeaders(providerId, apiKey, request.requestId),
      body: JSON.stringify(researchBody(providerId, model, request)),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.research,
  });
  if (providerId === "openai") return parseOpenAiResearch(payload);
  if (providerId === "openrouter") return parseOpenRouterResearch(payload);
  if (providerId === "google") return parseGeminiResearch(payload);
  if (providerId === "claude") return parseAnthropicResearch(payload);
  return parseGroqResearch(payload);
}
async function completeDiscussion(
  providerId: AiProviderId,
  context: ProviderContext,
  request: DiscussionRequest,
): Promise<DiscussionResponse> {
  let content = "";
  let reportUpdateProposal: DiscussionResponse["reportUpdateProposal"] = null;
  let completedAt = new Date().toISOString();
  for await (const event of streamDiscussion(providerId, context, request)) {
    if (event.type === "delta") content += event.content;
    else {
      reportUpdateProposal = event.reportUpdateProposal;
      completedAt = event.completedAt;
    }
  }
  return { content, reportUpdateProposal, completedAt };
}
async function* streamDiscussion(
  providerId: AiProviderId,
  context: ProviderContext,
  request: DiscussionRequest,
): AsyncGenerator<DiscussionStreamEvent> {
  const { apiKey, model } = requireProviderContext(context, providerId);
  const parser = new DiscussionContentStream(providerId);
  let sequence = 0;
  for await (const event of streamSse({
    providerId,
    operation: "discussion",
    url: generationUrl(providerId, context, model, true),
    init: {
      method: "POST",
      headers: {
        ...requestHeaders(providerId, apiKey, request.requestId),
        Accept: "text/event-stream",
      },
      body: JSON.stringify(discussionBody(providerId, model, request)),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.discussion,
    attempts: 1,
  })) {
    if (event.data === "[DONE]") break;
    const payload = parseStreamPayload(event.data, providerId);
    assertNoStreamError(payload, providerId);
    const rawDelta = streamTextDelta(providerId, payload);
    if (!rawDelta) continue;
    const content = parser.push(rawDelta);
    if (content) yield { type: "delta", sequence: ++sequence, content };
  }
  const complete = parser.complete(providerId, request);
  yield {
    type: "complete",
    sequence: ++sequence,
    reportUpdateProposal: complete.reportUpdateProposal,
    completedAt: new Date().toISOString(),
  };
}
function reportBody(
  providerId: AiProviderId,
  model: string,
  request: ReportGenerationRequest,
) {
  const system = reportSystemPrompt(request.systemPrompt);
  const user = reportUserPrompt(request);
  if (providerId === "openai") {
    return {
      model,
      instructions: system,
      input: user,
      text: {
        format: {
          type: "json_schema",
          name: "idea_report",
          strict: true,
          schema: REPORT_JSON_SCHEMA,
        },
      },
    };
  }
  if (providerId === "google") {
    return {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: REPORT_JSON_SCHEMA,
      },
    };
  }
  if (providerId === "claude") {
    return {
      model,
      max_tokens: 3_000,
      system,
      messages: [{ role: "user", content: user }],
    };
  }
  if (providerId === "openrouter") {
    return {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    };
  }
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };
}
function discussionBody(
  providerId: AiProviderId,
  model: string,
  request: DiscussionRequest,
) {
  const system = discussionSystemPrompt(request);
  const messages = discussionMessages(request);
  if (providerId === "openai") {
    return {
      model,
      instructions: system,
      input: messages,
      text: {
        format: {
          type: "json_schema",
          name: "discussion_reply",
          strict: true,
          schema: DISCUSSION_JSON_SCHEMA,
        },
      },
      stream: true,
    };
  }
  if (providerId === "google") {
    return {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
        responseJsonSchema: DISCUSSION_JSON_SCHEMA,
      },
    };
  }
  if (providerId === "claude") {
    return { model, max_tokens: 2_500, system, messages, stream: true };
  }
  if (providerId === "openrouter") {
    return {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      temperature: 0.5,
    };
  }
  return {
    model,
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    temperature: 0.5,
    response_format: { type: "json_object" },
  };
}
function researchBody(
  providerId: Exclude<AiProviderId, "custom">,
  model: string,
  request: ResearchRequest,
) {
  const prompt = researchPrompt(request);
  if (providerId === "openai") {
    return {
      model,
      input: prompt,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
    };
  }
  if (providerId === "openrouter") {
    return {
      model,
      messages: [{ role: "user", content: prompt }],
      tools: [
        { type: "openrouter:web_search", parameters: { max_results: 5 } },
      ],
    };
  }
  if (providerId === "google") {
    return {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    };
  }
  if (providerId === "claude") {
    return {
      model,
      max_tokens: 2_500,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    };
  }
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    citation_options: "enabled",
    compound_custom: { tools: { enabled_tools: ["web_search"] } },
  };
}
function generationUrl(
  providerId: AiProviderId,
  context: ProviderContext,
  model: string,
  stream: boolean,
) {
  const base = providerBaseUrl(context, providerId);
  if (providerId === "openai") return `${base}/responses`;
  if (providerId === "google") {
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return `${base}/models/${encodeURIComponent(model)}:${action}`;
  }
  if (providerId === "claude") return `${base}/messages`;
  return `${base}/chat/completions`;
}
function responseText(
  providerId: AiProviderId,
  payload: unknown,
  operation: "report-generation" | "discussion",
) {
  const text =
    providerId === "openai"
      ? extractOpenAiText(payload)
      : providerId === "google"
        ? extractGeminiText(payload)
        : providerId === "claude"
          ? extractAnthropicText(payload)
          : extractChatText(payload);
  return requireResponseText(text, providerId, operation);
}
function streamTextDelta(
  providerId: AiProviderId,
  payload: Record<string, unknown>,
) {
  if (providerId === "openai") {
    return payload.type === "response.output_text.delta" &&
      typeof payload.delta === "string"
      ? payload.delta
      : null;
  }
  if (providerId === "google") return extractGeminiText(payload);
  if (providerId === "claude") {
    return payload.type === "content_block_delta" &&
      isRecord(payload.delta) &&
      payload.delta.type === "text_delta" &&
      typeof payload.delta.text === "string"
      ? payload.delta.text
      : null;
  }
  if (
    !Array.isArray(payload.choices) ||
    !isRecord(payload.choices[0]) ||
    !isRecord(payload.choices[0].delta)
  )
    return null;
  return typeof payload.choices[0].delta.content === "string"
    ? payload.choices[0].delta.content
    : null;
}
function parseOpenAiResearch(payload: unknown) {
  const output = researchArray(payload, "output", "openai");
  const citations: CitationInput[] = [];
  for (const item of output) {
    if (!isRecord(item)) throw invalidResearchOutput("openai");
    if (Array.isArray(item.content)) {
      for (const part of boundedResearchArray(item.content, "openai")) {
        if (!isRecord(part)) throw invalidResearchOutput("openai");
        const annotations =
          part.annotations === undefined
            ? []
            : boundedResearchArray(part.annotations, "openai");
        if (part.text !== undefined && typeof part.text !== "string")
          throw invalidResearchOutput("openai");
        if (
          typeof part.text === "string" &&
          part.text.length > PROVIDER_RESPONSE_LIMITS.findingCharacters
        ) {
          throw invalidResearchOutput("openai");
        }
        if (!annotations.length) continue;
        if (typeof part.text !== "string")
          throw invalidResearchOutput("openai");
        const text = part.text;
        for (const annotation of annotations)
          citations.push(...citationFromAnnotation(annotation, text, "openai"));
      }
    } else if (item.content !== undefined) {
      throw invalidResearchOutput("openai");
    }
    if (item.type === "web_search_call") {
      if (item.action !== undefined && !isRecord(item.action))
        throw invalidResearchOutput("openai");
      const sources =
        isRecord(item.action) && item.action.sources !== undefined
          ? boundedResearchArray(item.action.sources, "openai")
          : [];
      for (const source of sources) {
        if (!isRecord(source)) throw invalidResearchOutput("openai");
        citations.push({ url: source.url, title: source.title, text: null });
      }
    }
  }
  return normalizeCitations(citations, "openai");
}
function parseOpenRouterResearch(payload: unknown) {
  const choices = researchArray(payload, "choices", "openrouter");
  if (!choices.length) return { findings: [], sources: [] };
  const choice = choices[0];
  if (!isRecord(choice) || !isRecord(choice.message))
    throw invalidResearchOutput("openrouter");
  const content = messageContent(choice.message);
  if (
    content === null ||
    (content && content.length > PROVIDER_RESPONSE_LIMITS.findingCharacters)
  ) {
    throw invalidResearchOutput("openrouter");
  }
  if (
    choice.message.annotations !== undefined &&
    !Array.isArray(choice.message.annotations)
  ) {
    throw invalidResearchOutput("openrouter");
  }
  const text = content ?? "";
  const annotations = Array.isArray(choice.message.annotations)
    ? choice.message.annotations
    : [];
  return normalizeCitations(
    annotations.flatMap((annotation) =>
      citationFromAnnotation(annotation, text, "openrouter"),
    ),
    "openrouter",
  );
}
function parseAnthropicResearch(payload: unknown) {
  const content = researchArray(payload, "content", "claude");
  const citations: CitationInput[] = [];
  for (const block of content) {
    if (!isRecord(block) || typeof block.type !== "string")
      throw invalidResearchOutput("claude");
    if (block.type !== "text") {
      if (block.citations !== undefined) throw invalidResearchOutput("claude");
      continue;
    }
    if (
      typeof block.text !== "string" ||
      block.text.length > PROVIDER_RESPONSE_LIMITS.findingCharacters
    )
      throw invalidResearchOutput("claude");
    if (block.citations === undefined) continue;
    for (const citation of boundedResearchArray(block.citations, "claude")) {
      if (!isRecord(citation)) throw invalidResearchOutput("claude");
      citations.push({
        url: citation.url,
        title: citation.title,
        text: citation.cited_text,
      });
    }
  }
  return normalizeCitations(citations, "claude");
}
function parseGroqResearch(payload: unknown) {
  const choices = researchArray(payload, "choices", "groq");
  if (!choices.length) return { findings: [], sources: [] };
  const choice = choices[0];
  if (!isRecord(choice) || !isRecord(choice.message))
    throw invalidResearchOutput("groq");
  if (
    choice.message.content !== undefined &&
    choice.message.content !== null &&
    typeof choice.message.content !== "string"
  ) {
    throw invalidResearchOutput("groq");
  }
  if (
    typeof choice.message.content === "string" &&
    choice.message.content.length > PROVIDER_RESPONSE_LIMITS.findingCharacters
  ) {
    throw invalidResearchOutput("groq");
  }
  const tools = choice.message.executed_tools;
  if (tools === undefined) return { findings: [], sources: [] };
  const boundedTools = boundedResearchArray(tools, "groq");
  const citations: CitationInput[] = [];
  for (const tool of boundedTools) {
    if (!isRecord(tool)) throw invalidResearchOutput("groq");
    if (tool.search_results !== undefined && !isRecord(tool.search_results))
      throw invalidResearchOutput("groq");
    if (isRecord(tool.search_results)) {
      const results =
        tool.search_results.results === undefined
          ? []
          : boundedResearchArray(tool.search_results.results, "groq");
      for (const result of results) {
        if (!isRecord(result)) throw invalidResearchOutput("groq");
        citations.push({
          url: result.url,
          title: result.title,
          text: result.content,
        });
      }
    }
    if (
      tool.output !== undefined &&
      tool.output !== null &&
      typeof tool.output !== "string"
    )
      throw invalidResearchOutput("groq");
    citations.push(...citationsFromToolOutput(tool.output, "groq"));
  }
  return normalizeCitations(citations, "groq");
}
function parseGeminiResearch(payload: unknown) {
  const candidates = researchArray(payload, "candidates", "google");
  if (!candidates.length) return { findings: [], sources: [] };
  const candidate = candidates[0];
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.content) ||
    !Array.isArray(candidate.content.parts)
  ) {
    throw invalidResearchOutput("google");
  }
  for (const part of boundedResearchArray(candidate.content.parts, "google")) {
    if (
      !isRecord(part) ||
      (part.text !== undefined && typeof part.text !== "string")
    )
      throw invalidResearchOutput("google");
    if (
      typeof part.text === "string" &&
      part.text.length > PROVIDER_RESPONSE_LIMITS.findingCharacters
    )
      throw invalidResearchOutput("google");
  }
  const metadata = candidate.groundingMetadata;
  if (metadata === undefined) return { findings: [], sources: [] };
  if (
    !isRecord(metadata) ||
    !Array.isArray(metadata.groundingChunks) ||
    !Array.isArray(metadata.groundingSupports)
  ) {
    throw invalidResearchOutput("google");
  }
  const groundingChunks = boundedResearchArray(
    metadata.groundingChunks,
    "google",
  );
  const groundingSupports = boundedResearchArray(
    metadata.groundingSupports,
    "google",
  );
  const citations: CitationInput[] = [];
  for (const support of groundingSupports) {
    if (
      !isRecord(support) ||
      !isRecord(support.segment) ||
      typeof support.segment.text !== "string" ||
      support.segment.text.length >
        PROVIDER_RESPONSE_LIMITS.findingCharacters ||
      !Array.isArray(support.groundingChunkIndices)
    ) {
      throw invalidResearchOutput("google");
    }
    for (const index of boundedResearchArray(
      support.groundingChunkIndices,
      "google",
    )) {
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= groundingChunks.length
      ) {
        throw invalidResearchOutput("google");
      }
      const chunk = groundingChunks[index];
      if (!isRecord(chunk) || !isRecord(chunk.web))
        throw invalidResearchOutput("google");
      citations.push({
        url: chunk.web.uri,
        title: chunk.web.title,
        text: support.segment.text,
      });
    }
  }
  return normalizeCitations(citations, "google");
}
function citationFromAnnotation(
  annotation: unknown,
  text: string,
  providerId: string,
): CitationInput[] {
  if (!isRecord(annotation)) throw invalidResearchOutput(providerId);
  if (
    annotation.url_citation !== undefined &&
    !isRecord(annotation.url_citation)
  )
    throw invalidResearchOutput(providerId);
  const citation = isRecord(annotation.url_citation)
    ? annotation.url_citation
    : annotation;
  if (citation.url === undefined || typeof citation.url !== "string")
    throw invalidResearchOutput(providerId);
  const start =
    typeof citation.start_index === "number" &&
    Number.isInteger(citation.start_index)
      ? citation.start_index
      : null;
  const end =
    typeof citation.end_index === "number" &&
    Number.isInteger(citation.end_index)
      ? citation.end_index
      : null;
  if (
    (citation.start_index !== undefined && start === null) ||
    (citation.end_index !== undefined && end === null)
  ) {
    throw invalidResearchOutput(providerId);
  }
  const citedText =
    typeof citation.cited_text === "string"
      ? citation.cited_text
      : start !== null &&
          end !== null &&
          start >= 0 &&
          end > start &&
          end <= text.length
        ? text.slice(start, end)
        : null;
  if (
    citation.cited_text !== undefined &&
    citation.cited_text !== null &&
    typeof citation.cited_text !== "string"
  ) {
    throw invalidResearchOutput(providerId);
  }
  if (
    (start !== null && start < 0) ||
    (end !== null && end < 0) ||
    (start !== null && end !== null && (end <= start || end > text.length))
  ) {
    throw invalidResearchOutput(providerId);
  }
  return [{ url: citation.url, title: citation.title, text: citedText }];
}
function citationsFromToolOutput(
  value: unknown,
  providerId: string,
): CitationInput[] {
  if (typeof value !== "string") return [];
  const urls = value.match(/https:\/\/[^\s<>"']+/g) ?? [];
  if (urls.length > PROVIDER_RESPONSE_LIMITS.researchCitations)
    throw invalidResearchOutput(providerId);
  return [...new Set(urls.map((url) => url.replace(/[),.;:!?\]]+$/, "")))].map(
    (url) => ({ url, title: null, text: null }),
  );
}
function parseStreamPayload(data: string, providerId: string) {
  try {
    const payload: unknown = JSON.parse(data);
    if (isRecord(payload)) return payload;
  } catch {
    // Provider data is deliberately omitted from the error.
  }
  throw providerError(
    "invalid-provider-output",
    "discussion",
    providerId,
    "The provider returned an invalid response stream.",
    true,
  );
}
function researchArray(
  payload: unknown,
  property: string,
  providerId: string,
): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload[property]))
    throw invalidResearchOutput(providerId);
  return boundedResearchArray(payload[property], providerId);
}
function boundedResearchArray(value: unknown, providerId: string): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > PROVIDER_RESPONSE_LIMITS.researchCitations
  ) {
    throw invalidResearchOutput(providerId);
  }
  return value;
}
function messageContent(message: Record<string, unknown>) {
  if (typeof message.content === "string") return message.content;
  if (message.content === undefined || message.content === null) return "";
  return null;
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
function assertNoStreamError(
  payload: Record<string, unknown>,
  providerId: string,
) {
  if (
    payload.type !== "error" &&
    payload.type !== "response.failed" &&
    !payload.error
  )
    return;
  throw providerError(
    "provider-unavailable",
    "discussion",
    providerId,
    "The provider interrupted the response stream.",
    true,
  );
}
