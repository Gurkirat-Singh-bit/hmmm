/**
 * @file serpapi.ts
 * @description Bounded SerpApi account verification and Google organic search adapter.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  ResearchResult,
  SearchProviderContext,
  SearchProviderPort,
  SearchRequest,
} from "../../domain/providers";
import {
  PROVIDER_ENDPOINTS,
  PROVIDER_RESPONSE_LIMITS,
  PROVIDER_TIMEOUT_MS,
  RESEARCH_QUERY_LIMITS,
} from "../config";
import { isRecord, normalizeCitations } from "../parsing";
import { providerError, requestJson } from "../transport";

const providerId = "serpapi" as const;

export const serpApiSearchProvider: SearchProviderPort = {
  descriptor: { id: providerId, kind: "search" },
  async probe(context) {
    const apiKey = requireApiKey(context);
    const payload = await requestJson({
      providerId,
      operation: "provider-configuration",
      url: credentialUrl("account.json", apiKey),
      init: { headers: { Accept: "application/json" } },
      timeoutMs: PROVIDER_TIMEOUT_MS.probe,
      attempts: 1,
      includeProviderMessage: false,
    });
    requireActiveSerpApiAccount(payload);
  },
  async search(context, request) {
    const apiKey = requireApiKey(context);
    const query = requireQuery(request.query);
    const payload = await requestJson({
      providerId,
      operation: "research",
      url: searchUrl(apiKey, query, request.engine),
      init: {
        headers: {
          Accept: "application/json",
          "X-Client-Request-Id": request.requestId,
        },
      },
      timeoutMs: PROVIDER_TIMEOUT_MS.research,
      includeProviderMessage: false,
    });
    return parseSerpApiResults(payload);
  },
};

function requireApiKey(context: SearchProviderContext) {
  const apiKey = context.apiKey?.trim();
  if (!apiKey) {
    throw providerError(
      "configuration-missing",
      "provider-configuration",
      providerId,
      "Add a SerpApi key in Research settings before using external search.",
    );
  }
  return apiKey;
}

function requireQuery(value: string) {
  const query = value.trim();
  if (
    query.length < RESEARCH_QUERY_LIMITS.minCharacters ||
    query.length > RESEARCH_QUERY_LIMITS.maxCharacters ||
    /[\r\n\u0000-\u001f\u007f]/u.test(query)
  ) {
    throw providerError(
      "invalid-provider-output",
      "research",
      providerId,
      "The planned research query is invalid. Try generating the report again.",
      true,
    );
  }
  return query;
}

/** Converts only the supported organic-result fields into normalized citations. */
export function parseSerpApiResults(payload: unknown): ResearchResult {
  if (!isRecord(payload)) throw invalidResults();
  if (payload.error !== undefined) throw searchRejected();
  if (
    !isRecord(payload.search_metadata) ||
    payload.search_metadata.status !== "Success" ||
    !Array.isArray(payload.organic_results) ||
    payload.organic_results.length >
      RESEARCH_QUERY_LIMITS.organicResponseResults
  ) {
    throw invalidResults();
  }

  const citations = payload.organic_results
    .slice(0, RESEARCH_QUERY_LIMITS.organicResults)
    .flatMap((result) => {
      if (!isRecord(result)) throw invalidResults();
      const { title, link, snippet, date } = result;
      if (
        (title !== undefined && typeof title !== "string") ||
        (link !== undefined && typeof link !== "string") ||
        (snippet !== undefined && typeof snippet !== "string") ||
        (date !== undefined && typeof date !== "string")
      ) {
        throw invalidResults();
      }
      if (!title?.trim() || !link?.trim() || !snippet?.trim()) return [];
      if (
        title.length > PROVIDER_RESPONSE_LIMITS.sourceTitleCharacters ||
        link.length > PROVIDER_RESPONSE_LIMITS.sourceUrlCharacters ||
        snippet.length > PROVIDER_RESPONSE_LIMITS.findingCharacters ||
        (date?.length ?? 0) >
          PROVIDER_RESPONSE_LIMITS.structuredStringCharacters
      ) {
        throw invalidResults();
      }
      const parsedDate =
        date && Number.isFinite(Date.parse(date))
          ? new Date(date).toISOString()
          : undefined;
      return [{ url: link, title, text: snippet, publishedAt: parsedDate }];
    });
  if (!citations.length) throw emptyResults();
  const normalized = normalizeCitations(citations, providerId);
  if (!normalized.sources.length || !normalized.findings.length)
    throw emptyResults();
  return normalized;
}

export function requireActiveSerpApiAccount(payload: unknown) {
  const status = isRecord(payload) ? payload.account_status : null;
  if (status === "Active") return;
  if (typeof status === "string") {
    throw providerError(
      "authentication-failed",
      "provider-configuration",
      providerId,
      "This SerpApi account is not active. Check the account before saving.",
    );
  }
  throw providerError(
    "invalid-provider-output",
    "provider-configuration",
    providerId,
    "SerpApi could not verify this key. Try again.",
    true,
  );
}

function credentialUrl(path: string, apiKey: string) {
  const url = new URL(path, `${PROVIDER_ENDPOINTS.serpapi}/`);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

function searchUrl(
  apiKey: string,
  query: string,
  engine: SearchRequest["engine"],
) {
  const url = new URL("search.json", `${PROVIDER_ENDPOINTS.serpapi}/`);
  url.searchParams.set("engine", engine);
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("safe", "active");
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", String(RESEARCH_QUERY_LIMITS.organicResults));
  url.searchParams.set("no_cache", "false");
  return url.toString();
}

function invalidResults(): never {
  throw providerError(
    "invalid-provider-output",
    "research",
    providerId,
    "SerpApi returned an invalid research response. Try again.",
    true,
  );
}

function emptyResults(): never {
  throw providerError(
    "provider-rejected",
    "research",
    providerId,
    "SerpApi found no usable organic results. Refine the idea and try again.",
  );
}

function searchRejected(): never {
  throw providerError(
    "provider-rejected",
    "research",
    providerId,
    "SerpApi could not complete this search. Check the key and quota, then try again.",
  );
}
