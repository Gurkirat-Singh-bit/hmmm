/**
 * @file use-discussion.ts
 * @description React state and actions for one idea discussion.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type {
  CaptureRecord,
  DataGeneration,
  NormalizedError,
  ReportUpdateProposal,
} from "@/features/domain/contracts";
import { normalizeError } from "@/features/domain/errors";
import { getVaultDatabase } from "@/features/vault/vault-runtime";

import {
  discussionService,
  type DiscussionThreadData,
  type DiscussionThreadSummary,
} from "./discussion-service";

export type DiscussionHomeState = Readonly<{
  loading: boolean;
  captures: readonly CaptureRecord[];
  threads: readonly DiscussionThreadSummary[];
  error: NormalizedError | null;
}>;
export function useDiscussionHome() {
  const [state, setState] = useState<DiscussionHomeState>({
    loading: true,
    captures: [],
    threads: [],
    error: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const load = async () => {
      try {
        const data = await discussionService.loadHome();
        if (active) setState({ loading: false, ...data, error: null });
      } catch (error) {
        if (active)
          setState((current) => ({
            ...current,
            loading: false,
            error: normalizeError(error, "database"),
          }));
      }
    };
    void getVaultDatabase()
      .then((database) => {
        if (!active) return;
        unsubscribe = database.subscriptions.subscribe((change) => {
          if (change.table === "captures" || change.table === "messages")
            void load();
        });
        void load();
      })
      .catch((reason) => {
        if (active)
          setState((current) => ({
            ...current,
            loading: false,
            error: normalizeError(reason, "database"),
          }));
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refreshToken]);

  return { ...state, refresh };
}
export function useDiscussionThread(captureId: string | undefined) {
  const [data, setData] = useState<DiscussionThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [notice, setNotice] = useState<NormalizedError | null>(null);
  const [composer, setComposerState] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const loadedCaptureId = useRef<string | null>(null);
  const dataRef = useRef<DiscussionThreadData | null>(null);
  const selectedGeneration = useRef<DataGeneration | null>(null);
  const composerRef = useRef("");
  const draftWrites = useRef(Promise.resolve());
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  const saveDraft = useCallback(
    (content: string) => {
      const generation = selectedGeneration.current;
      if (!captureId || generation === null) return;
      composerRef.current = content;
      draftWrites.current = draftWrites.current
        .catch(() => undefined)
        .then(() => discussionService.saveDraft(captureId, generation, content))
        .catch((reason) => setNotice(normalizeError(reason, "database")));
    },
    [captureId],
  );

  const setComposer = useCallback(
    (content: string) => {
      setComposerState(content);
      saveDraft(content);
    },
    [saveDraft],
  );

  useEffect(() => {
    if (!captureId) {
      selectedGeneration.current = null;
      loadedCaptureId.current = null;
      dataRef.current = null;
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    if (loadedCaptureId.current !== captureId) {
      selectedGeneration.current = null;
      dataRef.current = null;
      setLoading(true);
      setData(null);
    }
    setError(null);
    let active = true;
    let loadSequence = 0;
    let unsubscribe: (() => void) | null = null;
    const load = async () => {
      const sequence = ++loadSequence;
      try {
        const next = await discussionService.loadThread(captureId);
        if (!active || sequence !== loadSequence) return;
        dataRef.current = next;
        setData(next);
        setError(null);
        setLoading(false);
        selectedGeneration.current = next?.capture.generation ?? null;
        if (next && loadedCaptureId.current !== captureId) {
          loadedCaptureId.current = captureId;
          composerRef.current = next.draft?.content ?? "";
          setComposerState(composerRef.current);
        }
      } catch (reason) {
        if (!active || sequence !== loadSequence) return;
        const detail = normalizeError(reason, "database");
        setLoading(false);
        if (dataRef.current) setNotice(detail);
        else setError(detail);
      }
    };
    void getVaultDatabase()
      .then((database) => {
        if (!active) return;
        unsubscribe = database.subscriptions.subscribe((change) => {
          if (
            change.table === "captures" ||
            change.table === "reports" ||
            change.table === "sources" ||
            change.table === "messages" ||
            change.table === "discussion-drafts"
          ) {
            void load();
          }
        });
        void load();
      })
      .catch((reason) => {
        if (active) {
          setLoading(false);
          const detail = normalizeError(reason, "database");
          if (dataRef.current) setNotice(detail);
          else setError(detail);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [captureId, refreshToken]);

  useEffect(() => {
    if (!captureId) return;
    return () => {
      void discussionService.abort(
        captureId,
        "This reply was interrupted when you left the conversation.",
      );
      const generation = selectedGeneration.current;
      if (generation === null) return;
      void draftWrites.current
        .then(() =>
          discussionService.saveDraft(
            captureId,
            generation,
            composerRef.current,
          ),
        )
        .catch(() => undefined);
    };
  }, [captureId]);

  useEffect(() => {
    if (!captureId) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void discussionService.abort(
          captureId,
          "This reply was interrupted when the app moved to the background.",
        );
      }
    });
    return () => subscription.remove();
  }, [captureId]);

  const send = useCallback(async () => {
    const generation = selectedGeneration.current;
    if (!captureId || generation === null || !composerRef.current.trim())
      return;
    setNotice(null);
    try {
      await draftWrites.current;
      await discussionService.send(captureId, generation, composerRef.current);
      composerRef.current = "";
      setComposerState("");
    } catch (reason) {
      setNotice(normalizeError(reason, "discussion"));
    }
  }, [captureId]);

  const retry = useCallback(
    async (assistantId: string, mode: "restart" | "resume") => {
      const generation = selectedGeneration.current;
      if (!captureId || generation === null) return;
      setNotice(null);
      try {
        await discussionService.retry(captureId, generation, assistantId, mode);
      } catch (reason) {
        setNotice(normalizeError(reason, "discussion"));
      }
    },
    [captureId],
  );

  const applyProposal = useCallback(async (proposal: ReportUpdateProposal) => {
    const generation = selectedGeneration.current;
    if (generation === null) return false;
    setNotice(null);
    try {
      await discussionService.applyProposal(proposal, generation);
      return true;
    } catch (reason) {
      setNotice(normalizeError(reason, "discussion"));
      return false;
    }
  }, []);

  const sending =
    data?.messages.some(
      (message) =>
        message.role === "assistant" &&
        (message.status === "queued" || message.status === "streaming"),
    ) ?? false;
  return {
    data,
    loading,
    error,
    notice,
    composer,
    setComposer,
    sending,
    send,
    retry,
    applyProposal,
    refresh,
  };
}
