/**
 * @file use-research-settings.ts
 * @description React state for research consent, source selection, and protected search credentials.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useCallback, useEffect, useState } from "react";

import type {
  ResearchConsent,
  ResearchSource,
} from "@/features/domain/contracts";
import { normalizeError } from "@/features/domain/errors";
import { findAiProvider } from "@/features/onboarding/provider-config";
import {
  providerCredentials,
  readPreferences,
  saveResearchPreferences,
} from "@/features/onboarding/storage";
import {
  RESEARCH_SOURCES,
  supportsProviderResearch,
} from "@/features/provider/config";
import { serpApiSearchProvider } from "@/features/provider/search/serpapi";

type Consent = ResearchConsent["status"];

export function useResearchSettings() {
  const [enabled, setEnabledState] = useState(false);
  const [consent, setConsent] = useState<Consent>("unknown");
  const [source, setSource] = useState<ResearchSource>(
    RESEARCH_SOURCES.aiNative,
  );
  const [searchKey, setSearchKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState({
    id: "",
    label: "AI provider",
    model: "",
    supportsResearch: false,
  });

  const load = useCallback(async () => {
    const [preferences, search] = await Promise.all([
      readPreferences(),
      providerCredentials.readActive("search"),
    ]);
    setEnabledState(
      preferences.researchEnabled &&
        preferences.researchConsent.status === "granted",
    );
    setConsent(preferences.researchConsent.status);
    setSource(preferences.researchSource);
    setSearchKey(search?.secret ?? "");
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

  const sourceReady =
    source.kind === "external"
      ? Boolean(searchKey.trim())
      : provider.supportsResearch;

  const save = async (
    nextEnabled: boolean,
    nextConsent: Exclude<Consent, "unknown">,
  ) => {
    if (nextEnabled && !sourceReady) {
      setMessage(
        source.kind === "external"
          ? "Add a SerpApi key before turning research on."
          : "Choose an AI model with native web-search support or select SerpApi.",
      );
      return false;
    }
    setSaving(true);
    setMessage(source.kind === "external" ? "Checking SerpApi…" : null);
    try {
      if (source.kind === "external" && searchKey.trim()) {
        await serpApiSearchProvider.probe({ apiKey: searchKey.trim() });
      }
      await saveResearchPreferences({
        enabled: nextEnabled,
        consent: nextConsent,
        source,
        searchKey: source.kind === "external" ? searchKey.trim() : undefined,
      });
      setEnabledState(nextEnabled && nextConsent === "granted");
      setConsent(nextConsent);
      setMessage(
        source.kind === "external"
          ? searchKey.trim()
            ? "SerpApi verified and research settings saved."
            : "SerpApi selected. Add and verify a key before enabling research."
          : "Research settings saved.",
      );
      return true;
    } catch (error) {
      setMessage(normalizeError(error, "provider-configuration").message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (nextEnabled: boolean) => {
    await save(nextEnabled, nextEnabled ? "granted" : "denied");
  };

  const saveCurrent = async () => {
    await save(enabled, enabled ? "granted" : "denied");
  };

  return {
    consent,
    enabled,
    message,
    provider,
    save,
    saveCurrent,
    saving,
    searchKey,
    setEnabled,
    setSearchKey,
    setSource,
    source,
    sourceReady,
  };
}
