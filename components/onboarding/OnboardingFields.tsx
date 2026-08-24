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
  WarningCircleIcon as WarningCircle,
} from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import { ProviderLogo, ProviderLogoId } from '@/components/onboarding/ProviderLogo';
import { ProviderDefinition } from '@/features/onboarding/provider-config';

export function ProviderChoices<T extends string>({ options, value, onChange }: {
  options: readonly ProviderDefinition<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const selectedProviderId = options.some((option) => option.id === value) ? value : options[0].id;

  return (
    <View style={styles.group}>
      <Text style={styles.label}>PROVIDER</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {options.map((option) => {
          const selected = option.id === selectedProviderId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
            >
              <View style={[styles.logoShell, selected && styles.logoShellSelected]}>
                <ProviderLogo providerId={option.id as ProviderLogoId} />
              </View>
              <View style={styles.choiceCopy}>
                <Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
                <Text numberOfLines={2} style={[styles.choiceDescription, selected && styles.choiceDescriptionSelected]}>{option.description}</Text>
              </View>
              {selected ? <View style={styles.choiceCheck}><Check color={colors.ink} size={9} weight="bold" /></View> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function EndpointField({ value, onChangeText }: { value: string; onChangeText(value: string): void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>PROVIDER BASE URL</Text>
      <View style={[styles.inputShell, Boolean(value.trim()) && styles.inputComplete]}>
        <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={onChangeText} placeholder="https://api.example.com/v1" placeholderTextColor={colors.darkMuted} style={styles.input} value={value} />
      </View>
      <Text style={styles.endpointHint}>The app discovers models from this URL plus /models.</Text>
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
        <TextInput autoCapitalize="words" autoFocus onChangeText={onChangeText} onFocus={onFocus} onSubmitEditing={onSubmit} placeholder="Your name" placeholderTextColor={colors.darkMuted} returnKeyType="next" style={styles.input} value={value} />
      </View>
      {error ? <FieldStatus error message="Name is required" /> : null}
    </View>
  );
}

export function SecretField({ attempted, label, placeholder, value, onChangeText }: {
  attempted: boolean;
  label: string;
  placeholder: string;
  value: string;
  onChangeText(value: string): void;
}) {
  const [visible, setVisible] = useState(false);
  const complete = Boolean(value.trim());
  const error = attempted && !complete;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, complete && styles.inputComplete, error && styles.inputError]}>
        <Key color={complete ? colors.calm : colors.darkMuted} size={18} weight="bold" />
        <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.darkMuted} secureTextEntry={!visible} style={styles.input} value={value} />
        <Pressable accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} hitSlop={10} onPress={() => setVisible((current) => !current)}>
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
});
