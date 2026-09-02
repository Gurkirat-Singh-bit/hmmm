/**
 * @file transport.ts
 * @description Bounded HTTP, streaming, and WebSocket transport with normalized failures.
 * @author Gurkirat Singh
 * @license MIT
 */

import { fetch } from "expo/fetch";

import type { AppOperation, NormalizedErrorCode } from "../domain/contracts";
import { DomainError } from "../domain/errors";
import type { ProviderContext } from "../domain/providers";
import {
  PROVIDER_ENDPOINTS,
  PROVIDER_RETRY,
  PROVIDER_RESPONSE_LIMITS,
  type AiProviderId,
  type SpeechProviderId,
} from "./config";

type ProviderId = SpeechProviderId | AiProviderId;
type RequestProviderId = ProviderId | "serpapi";

type RequestOptions = Readonly<{
  providerId: RequestProviderId;
  operation: AppOperation;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  attempts?: number;
  includeProviderMessage?: boolean;
}>;

export type SseMessage = Readonly<{ event: string | null; data: string }>;
export function requireProviderContext(
  context: ProviderContext,
  providerId: ProviderId,
) {
  if (context.selection.providerId !== providerId) {
    throw providerError(
      "configuration-missing",
      "provider-configuration",
      providerId,
      "The selected provider does not match this configuration.",
    );
  }
  const apiKey = context.apiKey?.trim();
  const model = context.selection.model.trim();
  if (!apiKey || !model) {
    throw providerError(
      "configuration-missing",
      "provider-configuration",
      providerId,
      "Add an API key and an explicit model ID before using this provider.",
    );
  }
  return { apiKey, model };
}
export function normalizeCustomEndpoint(value: string | null) {
  if (!value?.trim()) {
    throw providerError(
      "configuration-missing",
      "provider-configuration",
      "custom",
      "Add the custom provider base URL.",
    );
  }
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.hostname
    ) {
      throw new Error("unsafe");
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw providerError(
      "invalid-url",
      "provider-configuration",
      "custom",
      "Use an HTTPS base URL without credentials, query parameters, or a fragment.",
    );
  }
}
export function providerBaseUrl(
  context: ProviderContext,
  providerId: ProviderId,
) {
  if (providerId === "custom")
    return normalizeCustomEndpoint(context.selection.endpoint);
  if (providerId === "claude") return PROVIDER_ENDPOINTS.anthropic;
  return PROVIDER_ENDPOINTS[providerId];
}
export function providerHeaders(
  providerId: ProviderId,
  apiKey: string,
  json = true,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (json) headers["Content-Type"] = "application/json";
  if (providerId === "deepgram") headers.Authorization = `Token ${apiKey}`;
  else if (providerId === "google") headers["x-goog-api-key"] = apiKey;
  else if (providerId === "claude") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}
export function requestHeaders(
  providerId: ProviderId,
  apiKey: string,
  requestId: string,
  json = true,
) {
  return {
    ...providerHeaders(providerId, apiKey, json),
    "X-Client-Request-Id": requestId,
    ...(providerId === "openai" ? { "Idempotency-Key": requestId } : {}),
  };
}
export async function requestJson(options: RequestOptions): Promise<unknown> {
  const { response, dispose } = await requestResponse(options);
  try {
    return await readJsonResponse(
      response,
      options.providerId,
      options.operation,
    );
  } catch (reason) {
    if (reason instanceof DomainError) throw reason;
    if (isAbortError(reason)) throw timeoutError(options);
    throw providerError(
      "invalid-provider-output",
      options.operation,
      options.providerId,
      "The provider returned an unreadable response.",
      true,
      response.status,
    );
  } finally {
    dispose();
  }
}

/** Reads and parses a provider body only after enforcing its byte ceiling. */
export async function readJsonResponse(
  response: Response,
  providerId: string,
  operation: AppOperation,
) {
  try {
    const text = await readBoundedResponseText(response, providerId, operation);
    const payload: unknown = JSON.parse(text);
    return payload;
  } catch (reason) {
    if (reason instanceof DomainError) throw reason;
    throw providerError(
      "invalid-provider-output",
      operation,
      providerId,
      "The provider returned an unreadable response.",
      true,
      response.status,
    );
  }
}
export async function requestProbe(
  options: RequestOptions,
  acceptedStatuses: readonly number[] = [],
) {
  let response: Awaited<ReturnType<typeof fetchWithTimeout>>;
  try {
    response = await fetchWithTimeout(options);
  } catch (reason) {
    throw normalizeTransportError(reason, options);
  }
  try {
    if (
      !response.response.ok &&
      !acceptedStatuses.includes(response.response.status)
    ) {
      throw await responseStatusError(options, response.response);
    }
    return response.response.status;
  } finally {
    response.dispose();
  }
}
export async function* streamSse(
  options: RequestOptions,
): AsyncGenerator<SseMessage> {
  const attempts = options.attempts ?? PROVIDER_RETRY.attempts;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let yielded = false;
    let call: Awaited<ReturnType<typeof fetchWithTimeout>> | null = null;
    try {
      call = await fetchWithTimeout(options);
      if (!call.response.ok) {
        const error = await responseStatusError(options, call.response);
        if (attempt + 1 < attempts && error.detail.retryable) {
          call.dispose();
          await wait(retryDelay(call.response, attempt));
          continue;
        }
        throw error;
      }
      const body = call.response.body;
      if (!body) {
        throw providerError(
          "invalid-provider-output",
          options.operation,
          options.providerId,
          "The provider did not return a response stream.",
          true,
          call.response.status,
        );
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let responseBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        responseBytes += value?.byteLength ?? 0;
        if (responseBytes > PROVIDER_RESPONSE_LIMITS.streamBytes) {
          throw providerError(
            "invalid-provider-output",
            options.operation,
            options.providerId,
            "The provider response stream is too large.",
            true,
            call.response.status,
          );
        }
        buffer += decoder
          .decode(value, { stream: !done })
          .replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          if (boundary > PROVIDER_RESPONSE_LIMITS.streamEventCharacters) {
            throw providerError(
              "invalid-provider-output",
              options.operation,
              options.providerId,
              "The provider response stream contains an oversized event.",
              true,
              call.response.status,
            );
          }
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const message = parseSseBlock(block);
          if (message) {
            yielded = true;
            yield message;
          }
          boundary = buffer.indexOf("\n\n");
        }
        if (buffer.length > PROVIDER_RESPONSE_LIMITS.streamEventCharacters) {
          throw providerError(
            "invalid-provider-output",
            options.operation,
            options.providerId,
            "The provider response stream contains an oversized event.",
            true,
            call.response.status,
          );
        }
        if (done) {
          const message = parseSseBlock(buffer);
          if (message) yield message;
          return;
        }
      }
    } catch (reason) {
      const error = normalizeTransportError(reason, options);
      if (!yielded && attempt + 1 < attempts && error.detail.retryable) {
        await wait(PROVIDER_RETRY.baseDelayMs * (attempt + 1));
        continue;
      }
      throw error;
    } finally {
      call?.dispose();
    }
  }
}
async function requestResponse(options: RequestOptions) {
  const attempts = options.attempts ?? PROVIDER_RETRY.attempts;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const call = await fetchWithTimeout(options);
      if (call.response.ok) return call;
      const error = await responseStatusError(options, call.response);
      if (attempt + 1 < attempts && error.detail.retryable) {
        call.dispose();
        await wait(retryDelay(call.response, attempt));
        continue;
      }
      call.dispose();
      throw error;
    } catch (reason) {
      const error = normalizeTransportError(reason, options);
      if (attempt + 1 < attempts && error.detail.retryable) {
        await wait(PROVIDER_RETRY.baseDelayMs * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw providerError(
    "unknown",
    options.operation,
    options.providerId,
    "The provider request failed.",
    true,
  );
}
async function fetchWithTimeout(options: RequestOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(options.url, {
      redirect: "error",
      ...options.init,
      body: options.init.body ?? undefined,
      signal: controller.signal,
    });
    return {
      response,
      dispose: () => {
        clearTimeout(timeout);
      },
    };
  } catch (reason) {
    clearTimeout(timeout);
    throw reason;
  }
}
function parseSseBlock(block: string): SseMessage | null {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
async function readBoundedResponseText(
  response: Response,
  providerId: string,
  operation: AppOperation,
) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > PROVIDER_RESPONSE_LIMITS.responseBytes
  ) {
    throw providerError(
      "invalid-provider-output",
      operation,
      providerId,
      "The provider response is too large.",
      true,
      response.status,
    );
  }
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let responseBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        responseBytes += value?.byteLength ?? 0;
        if (responseBytes > PROVIDER_RESPONSE_LIMITS.responseBytes) {
          throw providerError(
            "invalid-provider-output",
            operation,
            providerId,
            "The provider response is too large.",
            true,
            response.status,
          );
        }
        if (value?.byteLength)
          chunks.push(decoder.decode(value, { stream: !done }));
        if (done) {
          const tail = decoder.decode();
          if (tail) chunks.push(tail);
          return chunks.join("");
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  if (typeof response.text === "function") {
    const text = await response.text();
    if (
      new TextEncoder().encode(text).byteLength >
      PROVIDER_RESPONSE_LIMITS.responseBytes
    ) {
      throw providerError(
        "invalid-provider-output",
        operation,
        providerId,
        "The provider response is too large.",
        true,
        response.status,
      );
    }
    return text;
  }
  // Test doubles and older Expo shims may expose only json(); keep that path bounded too.
  if (typeof response.json === "function") {
    const payload: unknown = await response.json();
    const text = JSON.stringify(payload);
    if (
      typeof text !== "string" ||
      new TextEncoder().encode(text).byteLength >
        PROVIDER_RESPONSE_LIMITS.responseBytes
    ) {
      throw providerError(
        "invalid-provider-output",
        operation,
        providerId,
        "The provider response is too large.",
        true,
        response.status,
      );
    }
    return text;
  }
  throw providerError(
    "invalid-provider-output",
    operation,
    providerId,
    "The provider returned no readable response body.",
    true,
    response.status,
  );
}
function normalizeTransportError(reason: unknown, options: RequestOptions) {
  if (reason instanceof DomainError) return reason;
  if (isAbortError(reason)) return timeoutError(options);
  return providerError(
    "offline",
    options.operation,
    options.providerId,
    `${providerName(options.providerId)} could not be reached for ${operationName(options.operation)}. Check Android network access and try again.`,
    true,
  );
}
function timeoutError(options: RequestOptions) {
  return providerError(
    "timeout",
    options.operation,
    options.providerId,
    "The provider took too long to respond. Try again.",
    true,
  );
}
function statusError(options: RequestOptions, status: number) {
  let code: NormalizedErrorCode = "provider-rejected";
  let message =
    options.providerId === "serpapi"
      ? `SerpApi rejected the ${operationName(options.operation)} request (HTTP ${status}). Check the search configuration.`
      : `${providerName(options.providerId)} rejected the ${operationName(options.operation)} request (HTTP ${status}). Check the selected model.`;
  let retryable = false;
  if (status === 401 || status === 403) {
    code = "authentication-failed";
    message = `${providerName(options.providerId)} rejected the API key (HTTP ${status}).`;
  } else if (status === 402) {
    message = `${providerName(options.providerId)} does not have enough credits for ${operationName(options.operation)}. Add credits or choose a free model.`;
  } else if (status === 408) {
    code = "timeout";
    message = "The provider took too long to respond. Try again.";
    retryable = true;
  } else if (status === 409 || status === 425 || status === 429) {
    code = status === 429 ? "rate-limited" : "provider-unavailable";
    message =
      status === 429
        ? options.providerId === "serpapi"
          ? "The SerpApi quota or hourly limit was reached. Check the account, then try again."
          : "The provider rate limit was reached. Try again shortly."
        : "The provider is temporarily busy. Try again.";
    retryable = true;
  } else if (status >= 500) {
    code = "provider-unavailable";
    message = "The provider is temporarily unavailable. Try again.";
    retryable = true;
  }
  return providerError(
    code,
    options.operation,
    options.providerId,
    message,
    retryable,
    status,
  );
}
async function responseStatusError(
  options: RequestOptions,
  response: Response,
) {
  const fallback = statusError(options, response.status);
  if (options.includeProviderMessage === false) return fallback;
  try {
    const payload: unknown = JSON.parse(
      await readBoundedResponseText(
        response,
        options.providerId,
        options.operation,
      ),
    );
    const message = providerResponseMessage(payload);
    if (!message) return fallback;
    return providerError(
      fallback.detail.code,
      options.operation,
      options.providerId,
      `${providerName(options.providerId)}: ${message} (HTTP ${response.status}).`,
      fallback.detail.retryable,
      response.status,
    );
  } catch {
    return fallback;
  }
}
function providerResponseMessage(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return null;
  const value = payload as Record<string, unknown>;
  const nested =
    typeof value.error === "object" &&
    value.error !== null &&
    !Array.isArray(value.error)
      ? (value.error as Record<string, unknown>).message
      : value.error;
  const message = [value.err_msg, value.message, nested].find(
    (candidate) => typeof candidate === "string",
  );
  if (typeof message !== "string") return null;
  const safe = message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return safe ? safe.slice(0, 240) : null;
}
function providerName(providerId: string) {
  const names: Record<string, string> = {
    deepgram: "Deepgram",
    openrouter: "OpenRouter",
    openai: "OpenAI",
    groq: "Groq",
    google: "Google",
    claude: "Claude",
    custom: "Custom provider",
    serpapi: "SerpApi",
  };
  return names[providerId] ?? providerId;
}
function operationName(operation: AppOperation) {
  if (operation === "transcription") return "transcription";
  if (operation === "report-generation") return "report generation";
  if (operation === "discussion") return "discussion";
  if (operation === "research") return "research";
  if (operation === "provider-configuration") return "provider verification";
  return operation;
}
export function providerError(
  code: NormalizedErrorCode,
  operation: AppOperation,
  providerId: string,
  message: string,
  retryable = false,
  statusCode: number | null = null,
) {
  return new DomainError({
    code,
    operation,
    message,
    retryable,
    occurredAt: new Date().toISOString(),
    providerId,
    statusCode,
  });
}
function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, PROVIDER_RETRY.maxDelayMs);
  }
  return Math.min(
    PROVIDER_RETRY.baseDelayMs * (attempt + 1),
    PROVIDER_RETRY.maxDelayMs,
  );
}
function isAbortError(reason: unknown) {
  return reason instanceof Error && reason.name === "AbortError";
}
function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
