/**
 * @file use-system-prompt.ts
 * @description React state for loading, validating, and saving report instructions.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useState } from "react";

import {
  readPreferences,
  saveCustomSystemPrompt,
} from "@/features/onboarding/storage";
import {
  DEFAULT_REPORT_SYSTEM_PROMPT,
  normalizeReportSystemPrompt,
} from "@/features/provider/llm/prompts";

/** Loads the effective prompt and exposes save and restore operations for Settings. */
export function useSystemPrompt() {
  const [prompt, setPrompt] = useState(DEFAULT_REPORT_SYSTEM_PROMPT);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const preferences = await readPreferences();
      setPrompt(preferences.customSystemPrompt ?? DEFAULT_REPORT_SYSTEM_PROMPT);
      setIsCustom(Boolean(preferences.customSystemPrompt));
    } catch {
      setMessage("Could not load the current system prompt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Validates and saves the edited prompt, using null for the built-in default. */
  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const normalized = normalizeReportSystemPrompt(prompt);
      if (!normalized) throw new Error("System prompt cannot be empty.");
      const override =
        normalized === DEFAULT_REPORT_SYSTEM_PROMPT ? null : normalized;
      await saveCustomSystemPrompt(override);
      setPrompt(normalized);
      setIsCustom(Boolean(override));
      setMessage("System prompt saved. It applies to new report revisions.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the system prompt.",
      );
    } finally {
      setSaving(false);
    }
  }, [prompt]);

  /** Restores the built-in prompt and removes the local override from preferences. */
  const restore = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveCustomSystemPrompt(null);
      setPrompt(DEFAULT_REPORT_SYSTEM_PROMPT);
      setIsCustom(false);
      setMessage("Built-in system prompt restored.");
    } catch {
      setMessage("Could not restore the built-in system prompt.");
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    isCustom,
    loading,
    message,
    prompt,
    saving,
    restore,
    save,
    setPrompt,
  };
}
