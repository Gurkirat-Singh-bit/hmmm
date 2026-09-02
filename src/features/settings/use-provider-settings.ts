/**
 * @file use-provider-settings.ts
 * @description Editable provider configuration state and secure persistence.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useEffect, useState } from "react";
import {
  defaultAiModel,
  defaultAiProvider,
  defaultSpeechModel,
  defaultSpeechProvider,
  findAiProvider,
  findSpeechProvider,
  type AiProvider,
  type SpeechProvider,
} from "@/features/onboarding/provider-config";
import { readProfile, saveProfile } from "@/features/onboarding/storage";
import { normalizeError } from "@/features/domain/errors";
import { probeSelectedProviders } from "@/features/provider/probes";
export function useProviderSettings() {
  const [name, setName] = useState("You");
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>(
    defaultSpeechProvider,
  );
  const [speechModel, setSpeechModel] = useState<string>(defaultSpeechModel);
  const [speechKey, setSpeechKey] = useState("");
  const [speechEndpoint, setSpeechEndpoint] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>(defaultAiProvider);
  const [aiModel, setAiModel] = useState<string>(defaultAiModel);
  const [aiKey, setAiKey] = useState("");
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void readProfile()
      .then((profile) => {
        if (!profile) return;
        const speech = findSpeechProvider(profile.speechProvider);
        const ai = findAiProvider(profile.aiProvider);
        setName(profile.name);
        setSpeechProvider(speech.id);
        setSpeechModel(profile.speechModel || speech.starterModels[0] || "");
        setSpeechKey(profile.speechKey);
        setSpeechEndpoint(profile.speechEndpoint);
        setAiProvider(ai.id);
        setAiModel(profile.aiModel || ai.starterModels[0] || "");
        setAiKey(profile.aiKey);
        setAiEndpoint(profile.aiEndpoint);
      })
      .catch(() => setMessage("Could not load provider settings."));
  }, []);
  const save = async () => {
    if (
      !speechKey.trim() ||
      !speechModel.trim() ||
      !aiKey.trim() ||
      !aiModel.trim()
    ) {
      setMessage("Add both API keys and select both models before saving.");
      return;
    }
    setSaving(true);
    setMessage("Checking both provider connections…");
    try {
      await probeSelectedProviders({
        speech: {
          selection: {
            providerId: speechProvider,
            model: speechModel.trim(),
            endpoint: speechEndpoint.trim() || null,
          },
          apiKey: speechKey.trim(),
        },
        ai: {
          selection: {
            providerId: aiProvider,
            model: aiModel.trim(),
            endpoint: aiEndpoint.trim() || null,
          },
          apiKey: aiKey.trim(),
        },
      });
      await saveProfile({
        name,
        speechProvider,
        speechModel,
        speechKey: speechKey.trim(),
        speechEndpoint: speechEndpoint.trim(),
        aiProvider,
        aiModel,
        aiKey: aiKey.trim(),
        aiEndpoint: aiEndpoint.trim(),
      });
      setMessage(
        "Both provider connections passed and settings were saved securely.",
      );
    } catch (error) {
      setMessage(normalizeError(error, "provider-configuration").message);
    } finally {
      setSaving(false);
    }
  };

  return {
    speech: {
      provider: speechProvider,
      setProvider: setSpeechProvider,
      model: speechModel,
      setModel: setSpeechModel,
      apiKey: speechKey,
      setApiKey: setSpeechKey,
      endpoint: speechEndpoint,
      setEndpoint: setSpeechEndpoint,
    },
    ai: {
      provider: aiProvider,
      setProvider: setAiProvider,
      model: aiModel,
      setModel: setAiModel,
      apiKey: aiKey,
      setApiKey: setAiKey,
      endpoint: aiEndpoint,
      setEndpoint: setAiEndpoint,
    },
    message,
    save,
    saving,
  };
}

export type ProviderSettingsState = ReturnType<typeof useProviderSettings>;
