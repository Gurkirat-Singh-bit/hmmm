/**
 * @file export-data.tsx
 * @description Secure data export screen that excludes provider credentials.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ExportIcon as Export } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import { reconcileExportArtifacts, shareNonSecretJsonExport } from '@/features/export/export-service';

export default function ExportDataScreen() {
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void reconcileExportArtifacts().catch(() => undefined);
  }, []);

  const share = async () => {
    setSharing(true);
    setNotice(null);
    try {
      await shareNonSecretJsonExport();
      setNotice('The Android share sheet is open. This temporary copy stays in app cache until a later cleanup.');
    } catch {
      setNotice('Could not create a shareable export. Your ideas and settings remain on this device.');
    } finally {
      setSharing(false);
    }
  };

  return <SettingsSubpage supporting="Share a portable JSON snapshot of your local, non-secret data." title="Export data"><View style={styles.notice}><Text style={styles.noticeTitle}>API keys are never exported.</Text><Text style={styles.noticeBody}>Credentials remain in protected device storage. This export is created only from the app’s safe local snapshot.</Text></View><View style={styles.details}><Text style={styles.detailsTitle}>Included in this export</Text><Text style={styles.item}>• Profile and app preferences</Text><Text style={styles.item}>• Non-secret provider names, models, and endpoints</Text><Text style={styles.item}>• Captures, transcripts, and immutable report revisions</Text><Text style={styles.item}>• Citations, discussion messages, and job history</Text><Text style={styles.detailsHint}>Original audio, credentials, recording drafts, cleanup queues, deletion records, and temporary files are excluded.</Text></View>{notice ? <Text accessibilityLiveRegion="polite" style={styles.status}>{notice}</Text> : null}<Pressable accessibilityLabel="Share non-secret JSON export" accessibilityRole="button" accessibilityState={{ busy: sharing, disabled: sharing }} disabled={sharing} onPress={() => void share()} style={({ pressed }) => [styles.button, sharing && styles.disabled, pressed && styles.pressed]}>{sharing ? <ActivityIndicator color={colors.inkInverse} /> : <Export color={colors.inkInverse} size={19} weight="bold" />}<Text style={styles.buttonText}>{sharing ? 'Preparing export…' : 'Share JSON export'}</Text></Pressable></SettingsSubpage>;
}

const styles = StyleSheet.create({ notice: { gap: 6, padding: 18, borderRadius: radii.large, backgroundColor: colors.calmSoft }, noticeTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 15 }, noticeBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 }, details: { gap: 7, marginTop: 14, padding: 18, borderRadius: radii.large, backgroundColor: colors.canvas }, detailsTitle: { marginBottom: 3, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 }, item: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 }, detailsHint: { marginTop: 7, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 18 }, status: { marginTop: 14, color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12, lineHeight: 18 }, button: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14, borderRadius: radii.pill, backgroundColor: colors.ink }, buttonText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.7 } });
