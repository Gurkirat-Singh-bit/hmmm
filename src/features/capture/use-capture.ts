/**
 * @file use-capture.ts
 * @description React binding for the stateful capture service.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useState } from "react";

import {
  CaptureController,
  captureController,
  initialCaptureState,
} from "./capture-service";
import type { CaptureHomeState } from "./state";

/** Subscribes a capture screen to the singleton recording service and exposes commands. */
export function useCapture() {
  const [state, setState] = useState<CaptureHomeState>(initialCaptureState);
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    void captureController().then(async (capture) => {
      unsubscribe = capture.subscribe(setState);
      await capture.initialize();
    });
    return () => unsubscribe?.();
  }, []);
  const invoke = useCallback(
    (action: (capture: CaptureController) => Promise<void>) => {
      void captureController().then(action);
    },
    [],
  );
  return {
    ...state,
    start: () => invoke((capture) => capture.start()),
    pause: () => invoke((capture) => capture.pause()),
    resume: () => invoke((capture) => capture.resume()),
    cancel: () => invoke((capture) => capture.cancel()),
    finish: () => invoke((capture) => capture.finish()),
    retry: () => invoke((capture) => capture.retry()),
    retryCapture: (captureId: string) =>
      invoke((capture) => capture.retryCapture(captureId)),
  };
}
