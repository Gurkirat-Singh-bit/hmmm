/**
 * @file use-idea-playback.ts
 * @description React lifecycle wrapper around the retained-audio playback port.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AudioAsset,
  NormalizedError,
  PlaybackSessionPort,
  PlaybackState,
} from "@/features/domain/contracts";
import { normalizeError } from "@/features/domain/errors";
import { ExpoAudioPlaybackAdapter } from "@/features/capture/recording/playback";
export function useIdeaPlayback(audio: AudioAsset | null) {
  const session = useRef<PlaybackSessionPort | null>(null);
  const opening = useRef<Promise<PlaybackSessionPort> | null>(null);
  const action = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const stateRef = useRef<PlaybackState>("idle");
  const [state, setState] = useState<PlaybackState>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(audio?.durationMs ?? 0);
  const [error, setError] = useState<NormalizedError | null>(null);

  const dispose = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    const current = session.current;
    session.current = null;
    opening.current = null;
    if (current) void current.dispose();
  }, []);

  useEffect(() => {
    dispose();
    stateRef.current = "idle";
    setState("idle");
    setPositionMs(0);
    setDurationMs(audio?.durationMs ?? 0);
    setError(null);
    return dispose;
  }, [audio?.durationMs, audio?.uri, dispose]);

  const open = useCallback(async () => {
    if (!audio) throw new Error("No source audio was retained.");
    if (session.current) return session.current;
    if (opening.current) return opening.current;
    stateRef.current = "loading";
    setState("loading");
    opening.current = new ExpoAudioPlaybackAdapter()
      .open(audio)
      .then((opened) => {
        unsubscribe.current = opened.subscribe((event) => {
          if (event.type === "state") {
            stateRef.current = event.state;
            setState(event.state);
          }
          if (event.type === "position") {
            setPositionMs(event.positionMs);
            setDurationMs(event.durationMs);
          }
          if (event.type === "error") setError(event.error);
        });
        session.current = opened;
        return opened;
      })
      .finally(() => {
        opening.current = null;
      });
    return opening.current;
  }, [audio]);

  const toggle = useCallback(async () => {
    if (action.current) return;
    action.current = true;
    try {
      setError(null);
      const opened = await open();
      if (stateRef.current === "playing") await opened.pause();
      else {
        if (stateRef.current === "ended") await opened.seek(0);
        await opened.play();
      }
    } catch (cause) {
      const normalized = normalizeError(cause, "recording");
      stateRef.current = "failed";
      setState("failed");
      setError(normalized);
    } finally {
      action.current = false;
    }
  }, [open]);

  const stop = useCallback(async () => {
    if (action.current || !session.current) return;
    action.current = true;
    try {
      setError(null);
      await session.current.stop();
    } catch (cause) {
      const normalized = normalizeError(cause, "recording");
      stateRef.current = "failed";
      setState("failed");
      setError(normalized);
    } finally {
      action.current = false;
    }
  }, []);

  const seek = useCallback(
    async (nextPositionMs: number) => {
      try {
        await (await open()).seek(nextPositionMs);
      } catch (cause) {
        stateRef.current = "failed";
        setState("failed");
        setError(normalizeError(cause, "recording"));
      }
    },
    [open],
  );

  return { state, positionMs, durationMs, error, toggle, stop, seek };
}
