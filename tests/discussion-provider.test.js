/**
 * @file discussion-provider.test.js
 * @description Verifies the non-streaming recovery request used when discussion streaming cannot start.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, mock, test } from "bun:test";

const fetchMock = mock(async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  expect(body.stream).toBe(false);
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
});
