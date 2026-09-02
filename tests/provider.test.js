/**
 * @file provider.test.js
 * @description Verifies provider routing, authentication headers, URL validation, model filtering, and parsing bounds.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, mock, test } from "bun:test";

import {
  isAiProviderId,
  isSpeechProviderId,
  researchProviderDescription,
  SYSTEM_PROMPT_LIMITS,
  supportsProviderResearch,
} from "../src/features/provider/config";
mock.module("expo/fetch", () => ({ fetch: globalThis.fetch }));

const { filterModelCatalog, parseModelCatalog } =
  await import("../src/features/provider/model-discovery");
const {
  DEFAULT_REPORT_SYSTEM_PROMPT,
  normalizeReportSystemPrompt,
  reportSystemPrompt,
} = await import("../src/features/provider/llm/prompts");
const { normalizeCitations, parseGeneratedReport, safeSourceUrl } =
  await import("../src/features/provider/parsing");
const { normalizeCustomEndpoint, providerBaseUrl, providerHeaders } =
  await import("../src/features/provider/transport");

describe("provider protocols", () => {
  test("selects supported capabilities", () => {
    expect(isSpeechProviderId("deepgram")).toBe(true);
    expect(isAiProviderId("claude")).toBe(true);
    expect(isAiProviderId("deepgram")).toBe(false);
    expect(
      supportsProviderResearch("openrouter", "anthropic/claude-sonnet-4"),
    ).toBe(true);
    expect(supportsProviderResearch("custom", "anything")).toBe(false);
    expect(supportsProviderResearch("groq", "groq/compound-mini")).toBe(true);
    expect(researchProviderDescription("groq", "groq/compound-mini")).toContain(
      "one server-side web search",
    );
  });

  test("builds protocol-specific authentication headers", () => {
    expect(providerHeaders("deepgram", "secret").Authorization).toBe(
      "Token secret",
    );
    expect(providerHeaders("google", "secret")["x-goog-api-key"]).toBe(
      "secret",
    );
    expect(providerHeaders("claude", "secret")["anthropic-version"]).toBe(
      "2023-06-01",
    );
    expect(providerHeaders("openai", "secret").Authorization).toBe(
      "Bearer secret",
    );
  });

  test("accepts only credential-free HTTPS custom URLs", () => {
    expect(normalizeCustomEndpoint("https://example.com/v1/")).toBe(
      "https://example.com/v1",
    );
    expect(() => normalizeCustomEndpoint("http://example.com/v1")).toThrow();
    expect(() =>
      normalizeCustomEndpoint("https://user@example.com/v1"),
    ).toThrow();
    expect(() =>
      normalizeCustomEndpoint("https://example.com/v1?token=x"),
    ).toThrow();
    expect(
      providerBaseUrl(
        {
          selection: {
            providerId: "custom",
            model: "m",
            endpoint: "https://example.com/v1",
          },
          apiKey: "secret",
        },
        "custom",
      ),
    ).toBe("https://example.com/v1");
  });

  test("filters incompatible and oversized model identifiers", () => {
    const payload = {
      data: [
        { id: "gpt-5-mini" },
        { id: "whisper-1" },
        { id: "x".repeat(300) },
      ],
    };
    expect(parseModelCatalog(payload, "openai", "ai")).toEqual(["gpt-5-mini"]);
    expect(parseModelCatalog(payload, "openai", "speech")).toEqual([
      "whisper-1",
    ]);
  });

  test("searches model IDs using case-insensitive terms", () => {
    expect(
      filterModelCatalog(
        ["openai/gpt-5-mini", "anthropic/claude-sonnet-4", "gpt-4.1"],
        "GPT mini",
      ),
    ).toEqual(["openai/gpt-5-mini"]);
    expect(filterModelCatalog(["groq/compound"], "   ")).toEqual([
      "groq/compound",
    ]);
  });

  test("keeps the report format contract outside the editable prompt", () => {
    const custom = "Focus on commercial feasibility.";
    const composed = reportSystemPrompt(custom);
    expect(composed.startsWith(custom)).toBe(true);
    expect(composed).toContain("FORMAT CONTRACT:");
    expect(composed).toContain('"nextMove":string');
    expect(composed).not.toContain(DEFAULT_REPORT_SYSTEM_PROMPT);
    expect(reportSystemPrompt(null)).toContain(DEFAULT_REPORT_SYSTEM_PROMPT);
  });

  test("normalizes and bounds editable report prompts", () => {
    expect(normalizeReportSystemPrompt("  line one\r\nline two  ")).toBe(
      "line one\nline two",
    );
    expect(normalizeReportSystemPrompt("   ")).toBeNull();
    expect(() => normalizeReportSystemPrompt("bad\u0000prompt")).toThrow(
      "control characters",
    );
    expect(() =>
      normalizeReportSystemPrompt(
        "x".repeat(SYSTEM_PROMPT_LIMITS.maxCharacters + 1),
      ),
    ).toThrow("characters or fewer");
  });
});

describe("bounded response parsing", () => {
  test("normalizes only credential-free HTTPS citations", () => {
    const result = normalizeCitations(
      [{ url: "https://example.com/path", title: "Example", text: "Finding" }],
      "openai",
    );
    expect(result.sources).toHaveLength(1);
    expect(result.findings[0].sourceIds).toEqual([result.sources[0].id]);
    expect(safeSourceUrl("https://user@example.com/path")).toBeNull();
    expect(() =>
      normalizeCitations(
        [{ url: "https://user@example.com/path", title: "Bad", text: "Bad" }],
        "openai",
      ),
    ).toThrow();
  });

  test("parses reports and rejects unknown source ids", () => {
    const research = {
      findings: [],
      sources: [
        {
          id: "source-1",
          title: "Source",
          url: "https://example.com/",
          domain: "example.com",
          publishedAt: null,
          accessedAt: new Date(0).toISOString(),
        },
      ],
    };
    const report = JSON.stringify({
      title: "Idea",
      summary: "Summary",
      kind: "product",
      content: {
        gist: "Gist",
        evidence: [{ id: "e1", text: "Evidence", sourceIds: ["source-1"] }],
        risks: ["Risk"],
        nextMove: "Do it",
        verdict: null,
      },
    });
    expect(
      parseGeneratedReport(report, "openai", research).sources,
    ).toHaveLength(1);
    expect(() =>
      parseGeneratedReport(
        report.replace("source-1", "missing"),
        "openai",
        research,
      ),
    ).toThrow();
  });
});
