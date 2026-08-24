/**
 * @file providers.tsx
 * @description Settings route for editable provider and model configuration.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ProviderSettingsEditor } from '@/components/settings/ProviderSettingsEditor';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import { useProviderSettings } from '@/features/settings/use-provider-settings';

export default function ProvidersScreen() {
  const settings = useProviderSettings();
  return <SettingsSubpage supporting="Change the services, credentials, and models used by the app." title="Providers & models"><ProviderSettingsEditor settings={settings} />{settings.message ? <Text style={styles.message}>{settings.message}</Text> : null}<Pressable accessibilityRole="button" disabled={settings.saving} onPress={() => void settings.save()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>{settings.saving ? <ActivityIndicator color={colors.inkInverse} /> : <Text style={styles.buttonText}>Save provider settings</Text>}</Pressable></SettingsSubpage>;
}

const styles = StyleSheet.create({
  message: { marginTop: 12, color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  button: { height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: radii.pill, backgroundColor: colors.ink }, buttonText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, pressed: { opacity: 0.7 },
});
