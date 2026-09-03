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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState({
    id: "",
    label: "AI provider",
    model: "",
    supportsResearch: false,
  });

  const load = useCallback(async () => {
    try {
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
    } finally {
      setLoading(false);
    }
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
    const externalEnabled = nextEnabled && source.kind === "external";
    setSaving(true);
    setMessage(externalEnabled ? "Checking SerpApi…" : null);
    try {
      if (externalEnabled && searchKey.trim()) {
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
        externalEnabled
          ? "SerpApi verified and search choice saved."
          : "Search choice saved.",
      );
      return true;
    } catch (error) {
      setMessage(normalizeError(error, "provider-configuration").message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setEnabledDraft = (nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    setConsent(nextEnabled ? "granted" : "denied");
    setMessage(null);
  };

  const saveCurrent = async () => {
    await save(enabled, enabled ? "granted" : "denied");
  };

  const saveSearchKey = async () => {
    const apiKey = searchKey.trim();
    if (!apiKey) {
      setMessage("Paste a SerpApi key first.");
      return false;
    }
    setSaving(true);
    setMessage("Checking SerpApi…");
    try {
      await serpApiSearchProvider.probe({ apiKey });
      await saveResearchPreferences({
        enabled,
        consent: enabled ? "granted" : "denied",
        source,
        searchKey: apiKey,
      });
      setMessage("SerpApi key verified and saved securely.");
      return true;
    } catch (error) {
      setMessage(normalizeError(error, "provider-configuration").message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    consent,
    enabled,
    loading,
    message,
    provider,
    save,
    saveCurrent,
    saveSearchKey,
    saving,
    searchKey,
    setEnabledDraft,
    setSearchKey,
    setSource,
    source,
    sourceReady,
  };
}
