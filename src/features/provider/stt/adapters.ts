/**
 * @file adapters.ts
 * @description Wire-protocol adapters for uploaded and live speech transcription.
 * @author Gurkirat Singh
 * @license MIT
 */

import { File } from "expo-file-system";

import type { TranscriptSegment } from "../../domain/contracts";
import type {
  FinalTranscript,
  LiveTranscriptEvent,
  LiveTranscriptionSessionPort,
  ProviderContext,
  SpeechProviderPort,
  TranscriptionRequest,
} from "../../domain/providers";
import {
  DEEPGRAM_LIVE_AUDIO,
  PROVIDER_ENDPOINTS,
  PROVIDER_RESPONSE_LIMITS,
  PROVIDER_TIMEOUT_MS,
  SPEECH_PROVIDER_DESCRIPTORS,
} from "../config";
import { extractGeminiText, isRecord, requireResponseText } from "../parsing";
import {
  providerBaseUrl,
  providerError,
  requestHeaders,
  requestJson,
  requireProviderContext,
} from "../transport";

export const deepgramSpeechProvider: SpeechProviderPort = {
  descriptor: { ...SPEECH_PROVIDER_DESCRIPTORS.deepgram, kind: "speech" },
  transcribe: (context, request) => transcribeDeepgram(context, request),
  openLiveSession: (context, request) => openDeepgramSession(context, request),
};

export const openAiSpeechProvider = fileSpeechProvider("openai");
export const groqSpeechProvider = fileSpeechProvider("groq");
export const customSpeechProvider = fileSpeechProvider("custom");

export const openRouterSpeechProvider: SpeechProviderPort = {
  descriptor: { ...SPEECH_PROVIDER_DESCRIPTORS.openrouter, kind: "speech" },
  transcribe: transcribeOpenRouter,
};

export const googleSpeechProvider: SpeechProviderPort = {
  descriptor: { ...SPEECH_PROVIDER_DESCRIPTORS.google, kind: "speech" },
  transcribe: transcribeGemini,
};
function fileSpeechProvider(
  providerId: "openai" | "groq" | "custom",
): SpeechProviderPort {
  return {
    descriptor: { ...SPEECH_PROVIDER_DESCRIPTORS[providerId], kind: "speech" },
    transcribe: (context, request) =>
      transcribeOpenAiCompatible(providerId, context, request),
  };
}
async function transcribeDeepgram(
  context: ProviderContext,
  request: TranscriptionRequest,
) {
  const { apiKey, model } = requireProviderContext(context, "deepgram");
  const query = new URLSearchParams({ model, smart_format: "true" });
  if (request.languageTag) query.set("language", request.languageTag);
  const payload = await requestJson({
    providerId: "deepgram",
    operation: "transcription",
    url: `${PROVIDER_ENDPOINTS.deepgram}/listen?${query}`,
    init: {
      method: "POST",
      headers: {
        ...requestHeaders("deepgram", apiKey, request.requestId, false),
        "Content-Type": request.audio.mimeType,
      },
      body: new File(request.audio.uri),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.speech,
  });
  return parseDeepgramTranscript(payload, request.languageTag);
}
async function transcribeOpenAiCompatible(
  providerId: "openai" | "groq" | "custom",
  context: ProviderContext,
  request: TranscriptionRequest,
) {
  const { apiKey, model } = requireProviderContext(context, providerId);
  const form = new FormData();
  form.append("file", new File(request.audio.uri));
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (request.languageTag)
    form.append("language", primaryLanguage(request.languageTag));
  const payload = await requestJson({
    providerId,
    operation: "transcription",
    url: `${providerBaseUrl(context, providerId)}/audio/transcriptions`,
    init: {
      method: "POST",
      headers: requestHeaders(providerId, apiKey, request.requestId, false),
      body: form,
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.speech,
  });
  return parseOpenAiTranscript(payload, providerId, request.languageTag);
}
async function transcribeOpenRouter(
  context: ProviderContext,
  request: TranscriptionRequest,
) {
  const { apiKey, model } = requireProviderContext(context, "openrouter");
  const payload = await requestJson({
    providerId: "openrouter",
    operation: "transcription",
    url: `${PROVIDER_ENDPOINTS.openrouter}/audio/transcriptions`,
    init: {
      method: "POST",
      headers: requestHeaders("openrouter", apiKey, request.requestId),
      body: JSON.stringify({
        model,
        input_audio: {
          data: await new File(request.audio.uri).base64(),
          format: audioFormat(request.audio.container, request.audio.mimeType),
        },
        ...(request.languageTag
          ? { language: primaryLanguage(request.languageTag) }
          : {}),
        temperature: 0,
      }),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.speech,
  });
  return parseOpenAiTranscript(payload, "openrouter", request.languageTag);
}
async function transcribeGemini(
  context: ProviderContext,
  request: TranscriptionRequest,
) {
  const { apiKey, model } = requireProviderContext(context, "google");
  // ponytail: inline audio avoids a multi-request upload lifecycle; add Gemini Files API when captures can exceed 14 MB.
  if (request.audio.byteLength > 14_000_000) {
    throw providerError(
      "provider-rejected",
      "transcription",
      "google",
      "This recording is too large for inline Gemini transcription. Use a shorter or compressed recording.",
    );
  }
  const payload = await requestJson({
    providerId: "google",
    operation: "transcription",
    url: `${PROVIDER_ENDPOINTS.google}/models/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: requestHeaders("google", apiKey, request.requestId),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Transcribe this recording verbatim${request.languageTag ? ` in ${request.languageTag}` : ""}. Return only the transcript, with no commentary.`,
              },
              {
                inlineData: {
                  mimeType: request.audio.mimeType,
                  data: await new File(request.audio.uri).base64(),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
    timeoutMs: PROVIDER_TIMEOUT_MS.speech,
  });
  return {
    text: boundedTranscript(
      requireResponseText(
        extractGeminiText(payload),
        "google",
        "transcription",
      ),
      "google",
    ),
    languageTag: request.languageTag,
    segments: [],
  };
}
async function openDeepgramSession(
  context: ProviderContext,
  request: Readonly<{
    requestId: string;
    mimeType: string;
    languageTag: string | null;
  }>,
) {
  const { apiKey, model } = requireProviderContext(context, "deepgram");
  const query = new URLSearchParams({
    model,
    encoding: DEEPGRAM_LIVE_AUDIO.encoding,
    sample_rate: String(DEEPGRAM_LIVE_AUDIO.sampleRateHz),
    channels: String(DEEPGRAM_LIVE_AUDIO.channelCount),
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    endpointing: "300",
  });
  if (request.languageTag) query.set("language", request.languageTag);
  const socket = new WebSocket(`${PROVIDER_ENDPOINTS.deepgramLive}?${query}`, [
    "token",
    apiKey,
  ]);
  await waitForSocket(socket);
  return new DeepgramLiveSession(socket, request.languageTag);
}
class DeepgramLiveSession implements LiveTranscriptionSessionPort {
  private listeners = new Set<(event: LiveTranscriptEvent) => void>();
  private finalParts: string[] = [];
  private segments: TranscriptSegment[] = [];
  private transcriptCharacters = 0;
  private lastAudioSequence = -1;
  private eventSequence = 0;
  private finishing: Promise<FinalTranscript> | null = null;
  private resolveFinish: ((value: FinalTranscript) => void) | null = null;
  private rejectFinish: ((reason: unknown) => void) | null = null;
  private finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  constructor(
    private readonly socket: WebSocket,
    private readonly languageTag: string | null,
  ) {
    socket.onmessage = (event) => this.onMessage(event.data);
    socket.onerror = () =>
      this.fail("The live transcription connection failed.");
    socket.onclose = (event) => this.onClose(event);
  }
  subscribe(listener: (event: LiveTranscriptEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async sendAudio(chunk: Uint8Array, sequence: number) {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw providerError(
        "provider-unavailable",
        "transcription",
        "deepgram",
        "The live transcription connection is closed.",
        true,
      );
    }
    if (sequence <= this.lastAudioSequence) return;
    await waitForSocketCapacity(this.socket, chunk.byteLength);
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw providerError(
        "provider-unavailable",
        "transcription",
        "deepgram",
        "The live transcription connection is closed.",
        true,
      );
    }
    this.lastAudioSequence = sequence;
    this.socket.send(chunk);
  }
  finish() {
    if (this.finishing) return this.finishing;
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        providerError(
          "provider-unavailable",
          "transcription",
          "deepgram",
          "The live transcription connection is closed.",
          true,
        ),
      );
    }
    this.finishing = new Promise<FinalTranscript>((resolve, reject) => {
      this.resolveFinish = resolve;
      this.rejectFinish = reject;
      this.finishTimeout = setTimeout(
        () => this.fail("The live transcript could not be finalized in time."),
        PROVIDER_TIMEOUT_MS.liveFinish,
      );
      this.socket.send(JSON.stringify({ type: "Finalize" }));
    });
    return this.finishing;
  }
  async cancel() {
    if (this.closed) return;
    this.closed = true;
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "CloseStream" }));
    this.socket.close();
    this.rejectFinish?.(
      providerError(
        "cancelled",
        "transcription",
        "deepgram",
        "Live transcription was cancelled.",
      ),
    );
    this.clearFinish();
    this.emit({ type: "closed" });
  }
  private onMessage(data: unknown) {
    if (typeof data !== "string") return;
    if (data.length > PROVIDER_RESPONSE_LIMITS.streamEventCharacters) {
      this.failWith(
        providerError(
          "invalid-provider-output",
          "transcription",
          "deepgram",
          "Deepgram returned an oversized live response.",
          true,
        ),
      );
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      this.fail("The live transcription provider returned unreadable data.");
      return;
    }
    if (
      !isRecord(payload) ||
      payload.type !== "Results" ||
      !isRecord(payload.channel) ||
      !Array.isArray(payload.channel.alternatives)
    )
      return;
    const alternative = payload.channel.alternatives[0];
    if (!isRecord(alternative) || typeof alternative.transcript !== "string")
      return;
    const text = alternative.transcript.trim();
    if (text.length > PROVIDER_RESPONSE_LIMITS.transcriptCharacters) {
      this.failWith(
        providerError(
          "invalid-provider-output",
          "transcription",
          "deepgram",
          "Deepgram returned an oversized transcript.",
          true,
        ),
      );
      return;
    }
    const final = payload.is_final === true;
    if (final && text) {
      if (
        this.finalParts.length >= PROVIDER_RESPONSE_LIMITS.transcriptSegments ||
        this.transcriptCharacters + text.length >
          PROVIDER_RESPONSE_LIMITS.transcriptCharacters
      ) {
        this.failWith(
          providerError(
            "invalid-provider-output",
            "transcription",
            "deepgram",
            "Deepgram returned an oversized transcript.",
            true,
          ),
        );
        return;
      }
      let words: TranscriptSegment[];
      try {
        words = parseWords(alternative.words, "deepgram");
      } catch (error) {
        this.failWith(
          error instanceof Error
            ? error
            : providerError(
                "invalid-provider-output",
                "transcription",
                "deepgram",
                "Deepgram returned invalid transcript segments.",
                true,
              ),
        );
        return;
      }
      if (
        this.segments.length + words.length >
        PROVIDER_RESPONSE_LIMITS.transcriptSegments
      ) {
        this.failWith(
          providerError(
            "invalid-provider-output",
            "transcription",
            "deepgram",
            "Deepgram returned too many transcript segments.",
            true,
          ),
        );
        return;
      }
      this.finalParts.push(text);
      this.transcriptCharacters += text.length;
      this.segments.push(...words);
    }
    if (text)
      this.emit({
        type: "transcript",
        phase: final ? "final" : "provisional",
        text,
        sequence: ++this.eventSequence,
      });
    if (
      payload.from_finalize === true &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      this.socket.send(JSON.stringify({ type: "CloseStream" }));
    }
  }
  private onClose(event: { code?: number }) {
    if (this.closed) return;
    this.closed = true;
    if (this.finishing && event.code !== 1_000) {
      this.rejectFinish?.(
        providerError(
          "provider-unavailable",
          "transcription",
          "deepgram",
          "The live transcription connection closed early.",
          true,
        ),
      );
      this.clearFinish();
      this.emit({ type: "closed" });
      return;
    }
    const result = {
      text: this.finalParts.join(" ").trim(),
      languageTag: this.languageTag,
      segments: this.segments,
    };
    this.resolveFinish?.(result);
    this.clearFinish();
    this.emit({ type: "closed" });
  }
  private fail(message: string) {
    this.failWith(
      providerError(
        "provider-unavailable",
        "transcription",
        "deepgram",
        message,
        true,
      ),
    );
  }
  private failWith(error: Error) {
    if (this.closed) return;
    this.closed = true;
    this.rejectFinish?.(error);
    this.clearFinish();
    this.socket.close();
    this.emit({ type: "closed" });
  }
  private emit(event: LiveTranscriptEvent) {
    for (const listener of this.listeners) listener(event);
  }
  private clearFinish() {
    if (this.finishTimeout) clearTimeout(this.finishTimeout);
    this.finishTimeout = null;
    this.resolveFinish = null;
    this.rejectFinish = null;
  }
}
function parseDeepgramTranscript(
  payload: unknown,
  fallbackLanguage: string | null,
): FinalTranscript {
  if (
    !isRecord(payload) ||
    !isRecord(payload.results) ||
    !Array.isArray(payload.results.channels)
  ) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      "deepgram",
      "Deepgram returned an invalid transcript.",
      true,
    );
  }
  const channel = payload.results.channels[0];
  const alternative =
    isRecord(channel) && Array.isArray(channel.alternatives)
      ? channel.alternatives[0]
      : null;
  if (!isRecord(alternative) || typeof alternative.transcript !== "string") {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      "deepgram",
      "Deepgram returned an invalid transcript.",
      true,
    );
  }
  const text = boundedTranscript(alternative.transcript, "deepgram");
  const utterances = Array.isArray(payload.results.utterances)
    ? parseTimedSegments(payload.results.utterances, "deepgram")
    : [];
  return {
    text,
    languageTag:
      isRecord(channel) && typeof channel.detected_language === "string"
        ? boundedLanguage(channel.detected_language, "deepgram")
        : fallbackLanguage,
    segments: utterances.length
      ? utterances
      : parseWords(alternative.words, "deepgram"),
  };
}
function parseOpenAiTranscript(
  payload: unknown,
  providerId: string,
  fallbackLanguage: string | null,
): FinalTranscript {
  if (!isRecord(payload) || typeof payload.text !== "string") {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned an invalid transcript.",
      true,
    );
  }
  return {
    text: boundedTranscript(payload.text, providerId),
    languageTag:
      typeof payload.language === "string"
        ? boundedLanguage(payload.language, providerId)
        : fallbackLanguage,
    segments: Array.isArray(payload.segments)
      ? parseTimedSegments(payload.segments, providerId)
      : [],
  };
}
function parseTimedSegments(
  value: unknown[],
  providerId: string,
): TranscriptSegment[] {
  if (value.length > PROVIDER_RESPONSE_LIMITS.transcriptSegments) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned too many transcript segments.",
      true,
    );
  }
  return value.flatMap((item) => parseTimedSegment(item, providerId));
}
function parseTimedSegment(
  value: unknown,
  providerId: string,
): TranscriptSegment[] {
  if (
    !isRecord(value) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    typeof value.text !== "string"
  )
    return [];
  if (value.text.length > PROVIDER_RESPONSE_LIMITS.structuredStringCharacters) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned an oversized transcript segment.",
      true,
    );
  }
  const confidence =
    typeof value.confidence === "number" ? value.confidence : null;
  return [
    {
      startMs: Math.max(0, Math.round(value.start * 1_000)),
      endMs: Math.max(0, Math.round(value.end * 1_000)),
      text: value.text.trim(),
      confidence,
    },
  ];
}
function parseWords(value: unknown, providerId: string) {
  if (!Array.isArray(value)) return [];
  if (value.length > PROVIDER_RESPONSE_LIMITS.transcriptSegments) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned too many transcript segments.",
      true,
    );
  }
  return value.flatMap((word) => {
    if (
      !isRecord(word) ||
      typeof word.start !== "number" ||
      typeof word.end !== "number"
    )
      return [];
    const text =
      typeof word.punctuated_word === "string"
        ? word.punctuated_word
        : typeof word.word === "string"
          ? word.word
          : null;
    if (!text) return [];
    if (text.length > PROVIDER_RESPONSE_LIMITS.structuredStringCharacters) {
      throw providerError(
        "invalid-provider-output",
        "transcription",
        providerId,
        "The provider returned an oversized transcript segment.",
        true,
      );
    }
    return [
      {
        startMs: Math.max(0, Math.round(word.start * 1_000)),
        endMs: Math.max(0, Math.round(word.end * 1_000)),
        text,
        confidence:
          typeof word.confidence === "number" ? word.confidence : null,
      },
    ];
  });
}
function boundedTranscript(value: string, providerId: string) {
  const text = value.trim();
  if (text.length > PROVIDER_RESPONSE_LIMITS.transcriptCharacters) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned an oversized transcript.",
      true,
    );
  }
  return text;
}
function boundedLanguage(value: string, providerId: string) {
  if (value.length > PROVIDER_RESPONSE_LIMITS.structuredStringCharacters) {
    throw providerError(
      "invalid-provider-output",
      "transcription",
      providerId,
      "The provider returned an invalid language tag.",
      true,
    );
  }
  return value;
}
function primaryLanguage(languageTag: string) {
  return languageTag.split("-")[0].toLowerCase();
}
function audioFormat(container: string, mimeType: string) {
  const normalized = container.toLowerCase().replace(/^\./, "");
  if (["wav", "mp3", "flac", "m4a", "ogg", "webm", "aac"].includes(normalized))
    return normalized;
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return mimeType.split("/")[1]?.split(";")[0] || "wav";
}
function waitForSocket(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.close();
      reject(
        providerError(
          "timeout",
          "transcription",
          "deepgram",
          "Deepgram took too long to open a live session.",
          true,
        ),
      );
    }, PROVIDER_TIMEOUT_MS.liveConnect);
    socket.onopen = () => {
      clearTimeout(timeout);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(
        providerError(
          "provider-unavailable",
          "transcription",
          "deepgram",
          "Deepgram could not open a live session.",
          true,
        ),
      );
    };
  });
}
async function waitForSocketCapacity(socket: WebSocket, incomingBytes: number) {
  const deadline = Date.now() + DEEPGRAM_LIVE_AUDIO.bufferDrainTimeoutMs;
  while (
    socket.readyState === WebSocket.OPEN &&
    socket.bufferedAmount + incomingBytes >
      DEEPGRAM_LIVE_AUDIO.maxBufferedAmount
  ) {
    if (Date.now() >= deadline) {
      throw providerError(
        "provider-unavailable",
        "transcription",
        "deepgram",
        "The live transcription connection could not keep up with the recording.",
        true,
      );
    }
    await new Promise<void>((resolve) =>
      setTimeout(resolve, DEEPGRAM_LIVE_AUDIO.bufferPollMs),
    );
  }
}
