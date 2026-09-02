/**
 * @file discussion-provider.test.js
 * @description Verifies the non-streaming recovery request used when discussion streaming cannot start.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, mock, test } from "bun:test";

const fetchMock = mock(async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  if (body.stream) {
    return new Response(
      'data: {"choices":[{"delta":{"content":"{\\"content\\":\\"A live discussion reply.\\",\\"reportUpdate\\":null}"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              content: "A recovered discussion reply.",
              reportUpdate: null,
            }),
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

mock.module("expo/fetch", () => ({ fetch: fetchMock }));

const { openRouterProvider } =
  await import("../src/features/provider/llm/adapters");

describe("discussion provider recovery", () => {
  test("can complete a discussion without an SSE stream", async () => {
    const result = await openRouterProvider.completeDiscussion(
      {
        selection: {
          providerId: "openrouter",
          model: "openrouter/auto",
          endpoint: null,
        },
        apiKey: "test-key",
      },
      {
        requestId: "discussion:test",
        captureId: "capture:test",
        replyToMessageId: "message:test",
        transcript: "A voice-first note-taking idea.",
        report: null,
        reportRevision: null,
        messages: [
          { id: "message:test", role: "user", content: "What is risky?" },
        ],
        languageTag: "en",
        systemPrompt: null,
      },
    );

    expect(result.content).toBe("A recovered discussion reply.");
    expect(result.reportUpdateProposal).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("starts an LLM request for the streaming discussion path", async () => {
    fetchMock.mockClear();
    const events = [];
    for await (const event of openRouterProvider.streamDiscussion(
      {
        selection: {
          providerId: "openrouter",
          model: "openrouter/auto",
          endpoint: null,
        },
        apiKey: "test-key",
      },
      {
        requestId: "discussion:stream-test",
        captureId: "capture:test",
        replyToMessageId: "message:test",
        transcript: "A voice-first note-taking idea.",
        report: null,
        reportRevision: null,
        messages: [
          { id: "message:test", role: "user", content: "What is risky?" },
        ],
        languageTag: "en",
        systemPrompt: null,
      },
    )) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "delta")).toBe(true);
    expect(events.at(-1)?.type).toBe("complete");
  });
});
