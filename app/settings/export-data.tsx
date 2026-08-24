/**
 * @file export-data.tsx
 * @description Secure data export screen that excludes provider credentials.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ExportIcon as Export } from 'phosphor-react-native';
import { Share, Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import { readLanguage, readProfile } from '@/features/onboarding/storage';

async function exportData() {
  const [profile, language] = await Promise.all([readProfile(), readLanguage()]);
  const data = { exportedAt: new Date().toISOString(), preferences: { language }, providers: profile ? { aiModel: profile.aiModel, aiProvider: profile.aiProvider, speechModel: profile.speechModel, speechProvider: profile.speechProvider } : null, profile: profile ? { name: profile.name } : null };
  await Share.share({ message: JSON.stringify(data, null, 2), title: 'Hmmmidea data export' });
}

export default function ExportDataScreen() {
  return <SettingsSubpage supporting="Create a readable JSON copy of the non-secret information currently stored by the app." title="Export data"><View style={styles.notice}><Text style={styles.noticeTitle}>API keys are never exported.</Text><Text style={styles.noticeBody}>Credentials stay in protected device storage and are deliberately excluded from this file.</Text></View><View style={styles.details}><Text style={styles.detailsTitle}>Included in this export</Text><Text style={styles.item}>• Profile name</Text><Text style={styles.item}>• Language preference</Text><Text style={styles.item}>• Speech and AI provider names</Text><Text style={styles.item}>• Selected model IDs</Text><Text style={styles.detailsHint}>Future idea exports will be explicit. You will choose which captures or reports to include before sharing them.</Text></View><Pressable accessibilityRole="button" onPress={() => void exportData()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Export color={colors.inkInverse} size={19} weight="bold" /><Text style={styles.buttonText}>Share JSON export</Text></Pressable></SettingsSubpage>;
}

const styles = StyleSheet.create({ notice: { gap: 6, padding: 18, borderRadius: radii.large, backgroundColor: colors.calmSoft }, noticeTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 15 }, noticeBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 }, details: { gap: 7, marginTop: 14, padding: 18, borderRadius: radii.large, backgroundColor: colors.canvas }, detailsTitle: { marginBottom: 3, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 }, item: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13 }, detailsHint: { marginTop: 7, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 }, button: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14, borderRadius: radii.pill, backgroundColor: colors.ink }, buttonText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, pressed: { opacity: 0.7 } });
