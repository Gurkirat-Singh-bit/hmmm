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
  return <SettingsSubpage supporting="Repair provider choices safely. Hmmmidea verifies the selected speech and AI setups before saving." title="Providers & models"><ProviderSettingsEditor settings={settings} />{settings.message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{settings.message}</Text> : null}<Pressable accessibilityLabel="Verify both providers and save settings" accessibilityRole="button" accessibilityState={{ busy: settings.saving, disabled: settings.saving }} disabled={settings.saving} onPress={() => void settings.save()} style={({ pressed }) => [styles.button, pressed && styles.pressed, settings.saving && styles.disabled]}>{settings.saving ? <ActivityIndicator color={colors.inkInverse} /> : <Text style={styles.buttonText}>Verify and save providers</Text>}</Pressable></SettingsSubpage>;
}

const styles = StyleSheet.create({
  message: { marginTop: 12, color: colors.inkMuted, fontFamily: onboardingFonts.bodySemiBold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: colors.ink }, buttonText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.6 },
});
