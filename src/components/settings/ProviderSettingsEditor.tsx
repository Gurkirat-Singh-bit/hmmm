/**
 * @file ProviderSettingsEditor.tsx
 * @description In-place speech and AI provider configuration controls.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from "react-native";
import {
  EndpointField,
  ProviderChoices,
  SecretField,
} from "@/components/onboarding/OnboardingFields";
import { SearchableModelPicker } from "@/components/onboarding/SearchableModelPicker";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import {
  aiProviders,
  findAiProvider,
  findSpeechProvider,
  speechProviders,
} from "@/features/onboarding/provider-config";
import { useModelCatalog } from "@/features/onboarding/use-model-catalog";
import type { ProviderSettingsState } from "@/features/settings/use-provider-settings";
function SpeechEditor({
  config,
  light,
}: {
  config: ProviderSettingsState["speech"];
  light: boolean;
}) {
  const provider = findSpeechProvider(config.provider);
  const catalog = useModelCatalog(
    "speech",
    provider,
    config.apiKey,
    config.endpoint,
  );
  return (
    <View style={styles.fields}>
      <ProviderChoices
        light={light}
        options={speechProviders}
        value={config.provider}
        onChange={(id) => {
          config.setProvider(id);
          config.setModel(findSpeechProvider(id).starterModels[0] ?? "");
          if (id !== config.provider) {
            config.setApiKey("");
            config.setEndpoint("");
          }
        }}
      />
      {provider.id === "custom" ? (
        <EndpointField
          light={light}
          onChangeText={config.setEndpoint}
          value={config.endpoint}
        />
      ) : null}
      <SecretField
        attempted={false}
        label="API KEY"
        light={light}
        onChangeText={config.setApiKey}
        placeholder={`Paste ${provider.label} API key`}
        value={config.apiKey}
      />
      <SearchableModelPicker
        error={catalog.error}
        label="MODEL"
        light={light}
        loading={catalog.loading}
        onChange={config.setModel}
        onRefresh={catalog.canRefresh ? catalog.refresh : undefined}
        options={catalog.models}
        value={config.model}
      />
    </View>
  );
}
function AiEditor({
  config,
  light,
}: {
  config: ProviderSettingsState["ai"];
  light: boolean;
}) {
  const provider = findAiProvider(config.provider);
  const catalog = useModelCatalog(
    "ai",
    provider,
    config.apiKey,
    config.endpoint,
  );
  return (
    <View style={styles.fields}>
      <ProviderChoices
        light={light}
        options={aiProviders}
        value={config.provider}
        onChange={(id) => {
          config.setProvider(id);
          config.setModel(findAiProvider(id).starterModels[0] ?? "");
          if (id !== config.provider) {
            config.setApiKey("");
            config.setEndpoint("");
          }
        }}
      />
      {provider.id === "custom" ? (
        <EndpointField
          light={light}
          onChangeText={config.setEndpoint}
          value={config.endpoint}
        />
      ) : null}
      <SecretField
        attempted={false}
        label="API KEY"
        light={light}
        onChangeText={config.setApiKey}
        placeholder={`Paste ${provider.label} API key`}
        value={config.apiKey}
      />
      <SearchableModelPicker
        error={catalog.error}
        label="MODEL"
        light={light}
        loading={catalog.loading}
        onChange={config.setModel}
        onRefresh={catalog.canRefresh ? catalog.refresh : undefined}
        options={catalog.models}
        value={config.model}
      />
    </View>
  );
}
export function ProviderSettingsEditor({
  settings,
}: {
  settings: ProviderSettingsState;
}) {
  const light = true;
  return (
    <View style={styles.editor}>
      <View style={[styles.section, light && styles.sectionLight]}>
        <Text style={[styles.title, light && styles.titleLight]}>
          Speech to text
        </Text>
        <SpeechEditor config={settings.speech} light={light} />
      </View>
      <View style={[styles.section, light && styles.sectionLight]}>
        <Text style={[styles.title, light && styles.titleLight]}>
          Language model
        </Text>
        <AiEditor config={settings.ai} light={light} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 14 },
  section: {
    gap: 16,
    padding: 14,
    borderRadius: radii.large,
    backgroundColor: colors.darkSurface,
  },
  sectionLight: { backgroundColor: colors.surfaceMuted },
  title: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 19,
  },
  titleLight: { color: colors.ink },
  fields: { gap: 14 },
});
