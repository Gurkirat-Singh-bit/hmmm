/**
 * @file language.tsx
 * @description Settings route for the persistent local language preference.
 * @author Gurkirat Singh
 * @license MIT
 */

import { CheckIcon as Check } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import { readLanguage, saveLanguage, type AppLanguage } from '@/features/onboarding/storage';

const languages: AppLanguage[] = ['English', 'Hindi', 'Punjabi'];

export default function LanguageScreen() {
  const [selected, setSelected] = useState<AppLanguage>('English');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void readLanguage().then(setSelected).catch(() => setMessage('Could not load the saved language.')); }, []);
  const select = async (language: AppLanguage) => {
    setSelected(language);
    try {
      await saveLanguage(language);
      setMessage(`${language} saved for app controls and generated content.`);
    } catch {
      setMessage('Could not save the language.');
    }
  };
  return <SettingsSubpage supporting="Choose the language used for app controls and generated content." title="Language"><View accessibilityRole="radiogroup" style={styles.list}>{languages.map((language) => { const active = language === selected; return <Pressable accessibilityLabel={`Use ${language}`} accessibilityRole="radio" accessibilityState={{ checked: active }} key={language} onPress={() => void select(language)} style={({ pressed }) => [styles.row, active && styles.active, pressed && styles.pressed]}><Text style={styles.label}>{language}</Text>{active ? <Check color={colors.ink} size={19} weight="bold" /> : null}</Pressable>; })}</View>{message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}</SettingsSubpage>;
}

const styles = StyleSheet.create({
  list: { gap: 10 }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.medium, backgroundColor: colors.canvas }, active: { backgroundColor: colors.primary },
  label: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 15 }, pressed: { opacity: 0.7 }, message: { marginTop: 14, color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 12 },
});
