/**
 * @file use-research-settings.ts
 * @description React state for research consent and provider-grounding choices.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useState } from "react";

import {
  readPreferences,
  saveResearchPreferences,
} from "@/features/onboarding/storage";
import { findAiProvider } from "@/features/onboarding/provider-config";
import { supportsProviderResearch } from "@/features/provider/config";
export function useResearchSettings() {
  const [enabled, setEnabledState] = useState(false);
  const [consent, setConsent] = useState<"unknown" | "granted" | "denied">(
    "unknown",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState({
    id: "",
    label: "AI provider",
    model: "",
    supportsResearch: false,
  });

  const load = useCallback(async () => {
    const preferences = await readPreferences();
    setEnabledState(
      preferences.researchEnabled &&
        preferences.researchConsent.status === "granted",
    );
    setConsent(preferences.researchConsent.status);
    setProvider({
      id: preferences.aiProvider.providerId,
      label: findAiProvider(preferences.aiProvider.providerId).label,
      model: preferences.aiProvider.model,
      supportsResearch: supportsProviderResearch(
        preferences.aiProvider.providerId,
        preferences.aiProvider.model,
      ),
    });
  }, []);

  useEffect(() => {
    void load().catch(() => setMessage("Could not load research settings."));
  }, [load]);
  const save = async (
    nextEnabled: boolean,
    nextConsent: "granted" | "denied",
  ) => {
    setSaving(true);
    setMessage(null);
    try {
      await saveResearchPreferences({
        enabled: nextEnabled,
        consent: nextConsent,
      });
      setEnabledState(nextEnabled && nextConsent === "granted");
      setConsent(nextConsent);
    } catch {
      setMessage("Could not save research settings.");
    } finally {
      setSaving(false);
    }
  };
  const setEnabled = async (nextEnabled: boolean) => {
    if (nextEnabled && !provider.supportsResearch) {
      setMessage(
        "Choose an AI model with web-search support before turning research on.",
      );
      return;
    }
    if (nextEnabled && consent !== "granted") {
      setMessage(
        consent === "unknown"
          ? "Choose a research consent option before turning research on."
          : "Allow provider-native research before turning research on.",
      );
      return;
    }
    if (!nextEnabled && consent === "unknown") return;
    await save(nextEnabled, consent === "unknown" ? "denied" : consent);
  };

  return { consent, enabled, message, provider, saving, save, setEnabled };
}
