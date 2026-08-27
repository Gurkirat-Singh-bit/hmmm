/**
 * @file OnboardingFields.tsx
 * @description Form controls used to collect onboarding profile and provider values.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CheckCircleIcon as CheckCircle,
  CheckIcon as Check,
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
  KeyIcon as Key,
  MicrophoneIcon as Microphone,
  MagnifyingGlassIcon as MagnifyingGlass,
  WarningCircleIcon as WarningCircle,
} from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import { ProviderLogo, ProviderLogoId } from '@/components/onboarding/ProviderLogo';
import { ProviderDefinition } from '@/features/onboarding/provider-config';

export function ProviderChoices<T extends string>({ light = false, options, value, onChange }: {
  light?: boolean;
  options: readonly ProviderDefinition<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const selectedProviderId = options.some((option) => option.id === value) ? value : options[0].id;

  return (
    <View style={styles.group}>
      <Text style={[styles.label, light && styles.lightMutedText]}>PROVIDER</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {options.map((option) => {
          const selected = option.id === selectedProviderId;
          return (
            <Pressable
              accessibilityLabel={`${option.label}${selected ? ', selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [styles.choice, light && styles.choiceLight, selected && styles.choiceSelected, pressed && styles.pressed]}
            >
              <View style={[styles.logoShell, selected && styles.logoShellSelected]}>
                <ProviderLogo providerId={option.id as ProviderLogoId} />
              </View>
              <View style={styles.choiceCopy}>
                <Text style={[styles.choiceText, light && styles.lightText, selected && styles.choiceTextSelected]}>{option.label}</Text>
                <Text style={[styles.choiceDescription, light && styles.lightMutedText, selected && styles.choiceDescriptionSelected]}>{option.description}</Text>
              </View>
              {selected ? <View style={styles.choiceCheck}><Check color={colors.ink} size={9} weight="bold" /></View> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function EndpointField({ attempted = false, light = false, value, onChangeText }: { attempted?: boolean; light?: boolean; value: string; onChangeText(value: string): void }) {
  const error = attempted && !safeEndpoint(value);
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, light && styles.lightMutedText]}>PROVIDER BASE URL</Text>
      <View style={[styles.inputShell, light && styles.inputShellLight, Boolean(value.trim()) && !error && styles.inputComplete, error && styles.inputError]}>
        <TextInput accessibilityHint={error ? 'Invalid. Use a credential-free HTTPS URL.' : 'Required. Use an HTTPS URL without credentials or query parameters.'} accessibilityLabel="Provider base URL" autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={onChangeText} placeholder="https://api.example.com/v1" placeholderTextColor={light ? colors.inkMuted : colors.darkMuted} style={[styles.input, light && styles.lightText]} value={value} />
      </View>
      <Text style={styles.endpointHint}>The app discovers models from this URL plus /models.</Text>
      {error ? <FieldStatus error message="Use a credential-free HTTPS base URL" /> : null}
    </View>
  );
}

export function NameField({ attempted, value, onChangeText, onFocus, onSubmit }: {
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
      <View style={[styles.inputShell, Boolean(value.trim()) && styles.inputComplete, error && styles.inputError]}>
        <TextInput accessibilityHint={error ? 'Invalid. A name is required.' : 'Required. Used only for your local greeting.'} accessibilityLabel="Your name" autoCapitalize="words" autoFocus onChangeText={onChangeText} onFocus={onFocus} onSubmitEditing={onSubmit} placeholder="Your name" placeholderTextColor={colors.darkMuted} returnKeyType="next" style={styles.input} value={value} />
      </View>
      {error ? <FieldStatus error message="Name is required" /> : null}
    </View>
  );
}

export function MicrophonePermissionCard({ permission, onRequest }: {
  permission: 'undetermined' | 'denied' | 'granted';
  onRequest(): void;
}) {
  const granted = permission === 'granted';
  return <View style={styles.permissionCard}>
    <View style={[styles.permissionIcon, granted && styles.permissionIconGranted]}><Microphone color={colors.ink} size={19} weight="bold" /></View>
    <View style={styles.permissionCopy}><Text style={styles.permissionTitle}>Microphone access</Text><Text style={styles.permissionBody}>{granted ? 'Allowed. You can record the moment an idea arrives.' : 'Needed to record. Android shows the permission request only when you choose to allow it.'}</Text></View>
    {!granted ? <Pressable accessibilityLabel="Allow microphone access" accessibilityRole="button" onPress={onRequest} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Text style={styles.permissionButtonText}>{permission === 'denied' ? 'Try again' : 'Allow'}</Text></Pressable> : <CheckCircle color={colors.calm} size={21} weight="fill" />}
  </View>;
}

export function ResearchTransferChoices({ attempted, value, onChange }: {
  attempted: boolean;
  value: 'unknown' | 'granted' | 'denied';
  onChange(value: 'granted' | 'denied'): void;
}) {
  return <View style={styles.researchGroup}>
    <View style={styles.researchHeading}><View style={styles.researchIcon}><MagnifyingGlass color={colors.ink} size={17} weight="bold" /></View><View style={styles.researchCopy}><Text style={styles.researchTitle}>Optional provider-native research</Text><Text style={styles.researchBody}>When allowed, Hmmmidea sends a query derived from your transcript to the selected AI provider’s own grounding or search tools. The provider may receive that query and relevant transcript context.</Text></View></View>
    <View accessibilityRole="radiogroup" style={styles.researchChoices}>
      <Pressable accessibilityLabel="Allow provider-native research when needed" accessibilityRole="radio" accessibilityState={{ checked: value === 'granted' }} onPress={() => onChange('granted')} style={({ pressed }) => [styles.researchChoice, value === 'granted' && styles.researchChoiceSelected, pressed && styles.pressed]}><Text style={[styles.researchChoiceTitle, value === 'granted' && styles.researchChoiceTextSelected]}>Allow research when needed</Text><Text style={[styles.researchChoiceBody, value === 'granted' && styles.researchChoiceTextSelected]}>Research stays on, but runs only through your chosen AI provider.</Text></Pressable>
      <Pressable accessibilityLabel="Keep provider-native research off" accessibilityRole="radio" accessibilityState={{ checked: value === 'denied' }} onPress={() => onChange('denied')} style={({ pressed }) => [styles.researchChoice, value === 'denied' && styles.researchChoiceSelected, pressed && styles.pressed]}><Text style={[styles.researchChoiceTitle, value === 'denied' && styles.researchChoiceTextSelected]}>Keep research off</Text><Text style={[styles.researchChoiceBody, value === 'denied' && styles.researchChoiceTextSelected]}>Reports use your transcript only, with no provider-native grounding request.</Text></Pressable>
    </View>
    {attempted && value === 'unknown' ? <FieldStatus error message="Choose how optional research may use provider-native grounding" /> : null}
  </View>;
}

export function SecretField({ attempted, label, light = false, placeholder, value, onChangeText }: {
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
      <Text style={[styles.label, light && styles.lightMutedText]}>{label}</Text>
      <View style={[styles.inputShell, light && styles.inputShellLight, complete && styles.inputComplete, error && styles.inputError]}>
        <Key color={complete ? colors.calm : colors.darkMuted} size={18} weight="bold" />
        <TextInput accessibilityHint={error ? 'Invalid. An API key is required.' : 'Required. Stored in Android protected credential storage.'} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={light ? colors.inkMuted : colors.darkMuted} secureTextEntry={!visible} style={[styles.input, light && styles.lightText]} value={value} />
        <Pressable accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} accessibilityRole="button" accessibilityState={{ expanded: visible }} hitSlop={6} onPress={() => setVisible((current) => !current)} style={styles.secretVisibility}>
          {visible ? <EyeSlash color={colors.darkMuted} size={19} /> : <Eye color={colors.darkMuted} size={19} />}
        </Pressable>
      </View>
      {error ? <FieldStatus error message="API key is required" /> : null}
    </View>
  );
}

function FieldStatus({ error = false, message }: { error?: boolean; message: string }) {
  const Icon = error ? WarningCircle : CheckCircle;
  const color = error ? colors.danger : colors.calm;
  return <View style={styles.status}><Icon color={color} size={15} weight="fill" /><Text style={[styles.statusText, { color }]}>{message}</Text></View>;
}

function safeEndpoint(value: string) {
  try {
    const endpoint = new URL(value.trim());
    return endpoint.protocol === 'https:' && Boolean(endpoint.hostname)
      && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  group: { gap: 9 }, fieldGroup: { gap: 9 }, nameFieldGroup: { marginTop: 24 },
  label: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  inputShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkCanvas },
  inputComplete: { borderColor: colors.calm }, inputError: { borderColor: colors.danger },
  input: { flex: 1, color: colors.inkInverse, fontFamily: onboardingFonts.bodyRegular, fontSize: 15 },
  status: { minHeight: 17, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5 },
  statusText: { fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { position: 'relative', width: '48.5%', minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkCanvas },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  logoShell: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.canvasSoft },
  logoShellSelected: { backgroundColor: colors.canvas }, choiceCheck: { position: 'absolute', top: 4, right: 4, width: 13, height: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.canvas },
  choiceCopy: { flex: 1, gap: 2 }, choiceText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11 }, choiceTextSelected: { color: colors.ink },
  choiceDescription: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 8, lineHeight: 11 }, choiceDescriptionSelected: { color: colors.inkMuted },
  endpointHint: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10, lineHeight: 15 }, pressed: { opacity: 0.72 },
  choiceLight: { borderColor: colors.line, backgroundColor: colors.canvas }, inputShellLight: { borderColor: colors.line, backgroundColor: colors.canvas }, lightText: { color: colors.ink }, lightMutedText: { color: colors.inkMuted },
  permissionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 14, borderRadius: radii.large, backgroundColor: colors.darkSurface },
  permissionIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.happy }, permissionIconGranted: { backgroundColor: colors.calm },
  permissionCopy: { flex: 1, gap: 3 }, permissionTitle: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 13 }, permissionBody: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10, lineHeight: 14 },
  permissionButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.primary }, permissionButtonText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  researchGroup: { gap: 12, padding: 14, borderRadius: radii.large, backgroundColor: colors.darkSurface }, researchHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  researchIcon: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.happy }, researchCopy: { flex: 1, gap: 3 },
  researchTitle: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 13 }, researchBody: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10, lineHeight: 15 },
  researchChoices: { gap: 8 }, researchChoice: { gap: 3, minHeight: 66, padding: 12, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkCanvas }, researchChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  researchChoiceTitle: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 }, researchChoiceBody: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10, lineHeight: 14 }, researchChoiceTextSelected: { color: colors.ink },
  secretVisibility: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
});
