/**
 * @file OnboardingFields.tsx
 * @description Form controls used to collect onboarding profile and provider values.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CheckCircleIcon as CheckCircle,
  CheckIcon as Check,
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
  KeyIcon as Key,
  WarningCircleIcon as WarningCircle,
} from "phosphor-react-native";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import {
  ProviderLogo,
  ProviderLogoId,
} from "@/components/onboarding/ProviderLogo";
import { ProviderDefinition } from "@/features/onboarding/provider-config";
import type { ResearchSource } from "@/features/domain/contracts";
import { SERPAPI_MANAGE_KEY_URL } from "@/features/provider/config";
export function ProviderChoices<T extends string>({
  light = false,
  options,
  value,
  onChange,
}: {
  light?: boolean;
  options: readonly ProviderDefinition<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const selectedProviderId = options.some((option) => option.id === value)
    ? value
    : options[0].id;

  return (
    <View style={styles.group}>
      <Text style={[styles.label, light && styles.lightMutedText]}>
        PROVIDER
      </Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {options.map((option) => {
          const selected = option.id === selectedProviderId;
          return (
            <Pressable
              accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                styles.choice,
                light && styles.choiceLight,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.logoShell, selected && styles.logoShellSelected]}
              >
                <ProviderLogo providerId={option.id as ProviderLogoId} />
              </View>
              <View style={styles.choiceCopy}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.choiceText,
                    light && styles.lightText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.choiceDescription,
                    light && styles.lightMutedText,
                    selected && styles.choiceDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              {selected ? (
                <View style={styles.choiceCheck}>
                  <Check color={colors.ink} size={9} weight="bold" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export function EndpointField({
  attempted = false,
  light = false,
  value,
  onChangeText,
}: {
  attempted?: boolean;
  light?: boolean;
  value: string;
  onChangeText(value: string): void;
}) {
  const error = attempted && !safeEndpoint(value);
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, light && styles.lightMutedText]}>
        PROVIDER BASE URL
      </Text>
      <View
        style={[
          styles.inputShell,
          light && styles.inputShellLight,
          Boolean(value.trim()) && !error && styles.inputComplete,
          error && styles.inputError,
        ]}
      >
        <TextInput
          accessibilityHint={
            error
              ? "Invalid. Use a credential-free HTTPS URL."
              : "Required. Use an HTTPS URL without credentials or query parameters."
          }
          accessibilityLabel="Provider base URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={onChangeText}
          placeholder="https://api.example.com/v1"
          placeholderTextColor={light ? colors.inkMuted : colors.darkMuted}
          style={[styles.input, light && styles.lightText]}
          value={value}
        />
      </View>
      <Text style={styles.endpointHint}>
        The app discovers models from this URL plus /models.
      </Text>
      {error ? (
        <FieldStatus error message="Use a credential-free HTTPS base URL" />
      ) : null}
    </View>
  );
}
export function NameField({
  attempted,
  value,
  onChangeText,
  onFocus,
  onSubmit,
}: {
  attempted: boolean;
  value: string;
  onChangeText(value: string): void;
  onFocus(): void;
  onSubmit(): void;
}) {
  const error = attempted && !value.trim();
  return (
    <View style={[styles.fieldGroup, styles.nameFieldGroup]}>
      <Text style={styles.label}>YOUR NAME</Text>
      <View
        style={[
          styles.inputShell,
          Boolean(value.trim()) && styles.inputComplete,
          error && styles.inputError,
        ]}
      >
        <TextInput
          accessibilityHint={
            error
              ? "Invalid. A name is required."
              : "Required. Used only for your local greeting."
          }
          accessibilityLabel="Your name"
          autoCapitalize="words"
          autoFocus
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmit}
          placeholder="Your name"
          placeholderTextColor={colors.darkMuted}
          returnKeyType="next"
          style={styles.input}
          value={value}
        />
      </View>
      {error ? <FieldStatus error message="Name is required" /> : null}
    </View>
  );
}
export function ResearchTransferChoices({
  attempted,
  nativeSupported,
  providerLabel,
  searchKey,
  source,
  value,
  onChange,
  onSearchKeyChange,
  onSourceChange,
}: {
  attempted: boolean;
  nativeSupported: boolean;
  providerLabel: string;
  searchKey: string;
  source: ResearchSource;
  value: "unknown" | "granted" | "denied";
  onChange(value: "granted" | "denied"): void;
  onSearchKeyChange(value: string): void;
  onSourceChange(value: ResearchSource): void;
}) {
  const external = source.kind === "external";
  return (
    <View style={styles.researchGroup}>
      <Text style={styles.label}>RESEARCH SOURCE</Text>
      <View accessibilityRole="radiogroup" style={styles.researchChoices}>
        <ResearchChoice
          active={!external}
          body={`${providerLabel} searches directly. Requires a compatible model.`}
          label="Use my AI provider"
          onPress={() => onSourceChange({ kind: "ai-native" })}
        />
        <ResearchChoice
          active={external}
          body="Gets Google results with a separate key."
          label="SerpApi"
          onPress={() =>
            onSourceChange({
              kind: "external",
              providerId: "serpapi",
              engine: "google",
            })
          }
        />
      </View>
      {external ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.researchBody}>
            SerpApi is only for adding Google sources to idea reports. It is not
            used for transcription or Discuss.
          </Text>
          <Text style={styles.researchBody}>
            One derived query goes to SerpApi. Up to six result snippets and
            links then go to {providerLabel}.
          </Text>
          <Pressable
            accessibilityHint="Opens the official SerpApi account page"
            accessibilityLabel="Create a SerpApi account or get an API key"
            accessibilityRole="link"
            onPress={() =>
              void Linking.openURL(SERPAPI_MANAGE_KEY_URL).catch(
                () => undefined,
              )
            }
            style={({ pressed }) => [
              styles.serpApiLink,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.serpApiLinkText}>Get a SerpApi key</Text>
            <ArrowSquareOut color={colors.ink} size={17} weight="bold" />
          </Pressable>
          <SecretField
            attempted={attempted && value === "granted"}
            label="SERPAPI KEY"
            onChangeText={onSearchKeyChange}
            placeholder="Paste SerpApi key"
            value={searchKey}
          />
          <Text style={styles.researchBody}>
            SerpApi may retain standard searches for 31 days.
          </Text>
        </View>
      ) : null}
      {attempted && value === "granted" && !external && !nativeSupported ? (
        <FieldStatus
          error
          message="Choose a native-search model or use SerpApi"
        />
      ) : null}
      <Text style={styles.label}>CONSENT</Text>
      <View accessibilityRole="radiogroup" style={styles.researchChoices}>
        <Pressable
          accessibilityLabel="Use web search for sourced reports"
          accessibilityRole="radio"
          accessibilityState={{ checked: value === "granted" }}
          onPress={() => onChange("granted")}
          style={({ pressed }) => [
            styles.researchChoice,
            value === "granted" && styles.researchChoiceSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.researchChoiceTitle,
              value === "granted" && styles.researchChoiceTextSelected,
            ]}
          >
            Use search
          </Text>
          <Text
            style={[
              styles.researchChoiceBody,
              value === "granted" && styles.researchChoiceTextSelected,
            ]}
          >
            Find sources when a report needs them.
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Do not use web search"
          accessibilityRole="radio"
          accessibilityState={{ checked: value === "denied" }}
          onPress={() => onChange("denied")}
          style={({ pressed }) => [
            styles.researchChoice,
            value === "denied" && styles.researchChoiceSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.researchChoiceTitle,
              value === "denied" && styles.researchChoiceTextSelected,
            ]}
          >
            No search
          </Text>
          <Text
            style={[
              styles.researchChoiceBody,
              value === "denied" && styles.researchChoiceTextSelected,
            ]}
          >
            Use only my transcript.
          </Text>
        </Pressable>
      </View>
      {attempted && value === "unknown" ? (
        <FieldStatus
          error
          message="Choose whether reports may search the web"
        />
      ) : null}
    </View>
  );
}
function ResearchChoice({
  active,
  body,
  label,
  onPress,
}: {
  active: boolean;
  body: string;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityHint={body}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.researchChoice,
        active && styles.researchChoiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.researchChoiceTitle,
          active && styles.researchChoiceTextSelected,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.researchChoiceBody,
          active && styles.researchChoiceTextSelected,
        ]}
      >
        {body}
      </Text>
    </Pressable>
  );
}
export function SecretField({
  attempted,
  label,
  light = false,
  placeholder,
  value,
  onChangeText,
}: {
  attempted: boolean;
  label: string;
  light?: boolean;
  placeholder: string;
  value: string;
  onChangeText(value: string): void;
}) {
  const [visible, setVisible] = useState(false);
  const complete = Boolean(value.trim());
  const error = attempted && !complete;
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, light && styles.lightMutedText]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          light && styles.inputShellLight,
          complete && styles.inputComplete,
          error && styles.inputError,
        ]}
      >
        <Key
          color={complete ? colors.calm : colors.darkMuted}
          size={18}
          weight="bold"
        />
        <TextInput
          accessibilityHint={
            error
              ? "Invalid. An API key is required."
              : "Required. Stored in Android protected credential storage."
          }
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={light ? colors.inkMuted : colors.darkMuted}
          secureTextEntry={!visible}
          style={[styles.input, light && styles.lightText]}
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: visible }}
          hitSlop={6}
          onPress={() => setVisible((current) => !current)}
          style={styles.secretVisibility}
        >
          {visible ? (
            <EyeSlash color={colors.darkMuted} size={19} />
          ) : (
            <Eye color={colors.darkMuted} size={19} />
          )}
        </Pressable>
      </View>
      {error ? <FieldStatus error message="API key is required" /> : null}
    </View>
  );
}
function FieldStatus({
  error = false,
  message,
}: {
  error?: boolean;
  message: string;
}) {
  const Icon = error ? WarningCircle : CheckCircle;
  const color = error ? colors.danger : colors.calm;
  return (
    <View style={styles.status}>
      <Icon color={color} size={15} weight="fill" />
      <Text style={[styles.statusText, { color }]}>{message}</Text>
    </View>
  );
}
function safeEndpoint(value: string) {
  try {
    const endpoint = new URL(value.trim());
    return (
      endpoint.protocol === "https:" &&
      Boolean(endpoint.hostname) &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash
    );
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  fieldGroup: { gap: 9 },
  nameFieldGroup: { marginTop: 24 },
  label: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.darkLine,
    borderRadius: radii.medium,
    backgroundColor: colors.darkCanvas,
  },
  inputComplete: { borderColor: colors.calm },
  inputError: { borderColor: colors.danger },
  input: {
    flex: 1,
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 15,
  },
  status: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 5,
  },
  statusText: { fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    position: "relative",
    minWidth: 140,
    flexBasis: "46%",
    flexGrow: 1,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.darkLine,
    borderRadius: radii.medium,
    backgroundColor: colors.darkCanvas,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  logoShell: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.canvasSoft,
  },
  logoShellSelected: { backgroundColor: colors.canvas },
  choiceCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 13,
    height: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: colors.canvas,
  },
  choiceCopy: { flex: 1, gap: 2 },
  choiceText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 11,
  },
  choiceTextSelected: { color: colors.ink },
  choiceDescription: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 8,
    lineHeight: 11,
  },
  choiceDescriptionSelected: { color: colors.inkMuted },
  endpointHint: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 10,
    lineHeight: 15,
  },
  pressed: { opacity: 0.72 },
  choiceLight: { borderColor: colors.line, backgroundColor: colors.canvas },
  inputShellLight: { borderColor: colors.line, backgroundColor: colors.canvas },
  lightText: { color: colors.ink },
  lightMutedText: { color: colors.inkMuted },
  researchGroup: {
    gap: 12,
    padding: 14,
    borderRadius: radii.large,
    backgroundColor: colors.darkSurface,
  },
  researchBody: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 10,
    lineHeight: 15,
  },
  researchChoices: { gap: 8 },
  researchChoice: {
    gap: 3,
    minHeight: 66,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.darkLine,
    borderRadius: radii.medium,
    backgroundColor: colors.darkCanvas,
  },
  researchChoiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  researchChoiceTitle: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  researchChoiceBody: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 10,
    lineHeight: 14,
  },
  researchChoiceTextSelected: { color: colors.ink },
  serpApiLink: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
  },
  serpApiLinkText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
  },
  secretVisibility: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
});
