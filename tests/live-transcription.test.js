/**
 * @file live-transcription.test.js
 * @description Verifies live transcription closes on pause and opens a fresh stream on resume.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, test } from "bun:test";

import { RecordingLiveTranscription } from "../src/features/capture/recording/live-transcription";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeRecording() {
  let state = "recording";
  const listeners = new Set();
  return {
    id: "draft-1",
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async pause() {},
    async resume() {},
    async finish() {
      throw new Error("unused");
    },
    async cancel() {},
    emit(event) {
      if (event.type === "state") state = event.state;
      for (const listener of listeners) listener(event);
    },
  };
}

function fakeLiveSession(label) {
  const listeners = new Set();
  return {
    label,
    finalText: label,
    chunks: [],
    cancelled: false,
    finished: false,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async sendAudio(data, sequence) {
      this.chunks.push({ data: [...data], sequence });
    },
    async finish() {
      this.finished = true;
      return { text: this.finalText, languageTag: null, segments: [] };
    },
    async cancel() {
      this.cancelled = true;
    },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
  };
}

describe("recording live transcription", () => {
  test("keeps the live stream through pause and resumes audio delivery", async () => {
    const recording = fakeRecording();
    const sessions = [];
    const transcription = new RecordingLiveTranscription(
      recording,
      async () => {
        const session = fakeLiveSession(`session-${sessions.length + 1}`);
        sessions.push(session);
        return session;
      },
    );

    transcription.start();
    await tick();
    recording.emit({
      type: "audio-chunk",
      data: new Uint8Array([1, 2]),
      sequence: 1,
      mimeType: "audio/pcm",
    });
    await tick();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].chunks).toEqual([{ data: [1, 2], sequence: 1 }]);

    recording.emit({ type: "state", state: "paused" });
    await tick();
    expect(sessions[0].cancelled).toBe(false);

    recording.emit({ type: "state", state: "recording" });
    await tick();
    recording.emit({
      type: "audio-chunk",
      data: new Uint8Array([3]),
      sequence: 2,
      mimeType: "audio/pcm",
    });
    await tick();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].chunks).toEqual([
      { data: [1, 2], sequence: 1 },
      { data: [3], sequence: 2 },
    ]);

    await expect(transcription.finish()).resolves.toEqual({
      text: "session-1",
      languageTag: null,
      segments: [],
    });
    expect(sessions[0].finished).toBe(true);
  });

  test("returns cumulative finalized phrases without duplicating the final response", async () => {
    const recording = fakeRecording();
    let session;
    const transcription = new RecordingLiveTranscription(
      recording,
      async () => {
        session = fakeLiveSession("unused");
        session.finalText = "first phrase second phrase";
        return session;
      },
    );

    transcription.start();
    await tick();
    session.emit({
      type: "transcript",
      phase: "final",
      text: "first phrase",
      sequence: 1,
    });
    session.emit({
      type: "transcript",
      phase: "final",
      text: "second phrase",
      sequence: 2,
    });

    await expect(transcription.finish()).resolves.toEqual({
      text: "first phrase second phrase",
      languageTag: null,
      segments: [],
    });
  });
});
