/**
 * @file about.tsx
 * @description Settings route for application identity, license, and project links.
 * @author Gurkirat Singh
 * @license MIT
 */

import Constants from 'expo-constants';
import { GithubLogoIcon as GithubLogo, BugIcon as Bug, ArrowSquareOutIcon as ArrowSquareOut } from 'phosphor-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const repositoryUrl = 'https://github.com/Gurkirat-Singh-bit/hmmm';

function ExternalLink({ icon: Icon, label, url }: { icon: typeof GithubLogo; label: string; url: string }) {
  return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}><Icon color={colors.ink} size={20} weight="bold" /><Text style={styles.linkLabel}>{label}</Text><ArrowSquareOut color={colors.inkMuted} size={17} weight="bold" /></Pressable>;
}

export default function AboutScreen() {
  return <SettingsSubpage supporting="A local-first, voice-first home for ideas that arrive faster than you can type them." title="About Hmmmidea"><View style={styles.card}><Text style={styles.cardTitle}>Built in the open</Text><Text style={styles.body}>Hmmmidea is open-source software. You can inspect how local data is handled, suggest improvements, report problems, or build your own version.</Text><View style={styles.meta}><Text style={styles.metaLabel}>VERSION</Text><Text style={styles.metaValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text></View><View style={styles.meta}><Text style={styles.metaLabel}>LICENSE</Text><Text style={styles.metaValue}>MIT</Text></View></View><View style={styles.links}><ExternalLink icon={GithubLogo} label="View source on GitHub" url={repositoryUrl} /><ExternalLink icon={Bug} label="Report an issue" url={`${repositoryUrl}/issues`} /></View><Text style={styles.footer}>Designed for private thinking. Your content stays yours.</Text></SettingsSubpage>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 18, borderRadius: radii.large, backgroundColor: colors.primarySoft }, cardTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 19 }, body: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }, metaLabel: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1 }, metaValue: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  links: { gap: 10, marginTop: 14 }, link: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, borderRadius: radii.medium, backgroundColor: colors.canvas }, linkLabel: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 }, footer: { marginTop: 22, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, textAlign: 'center' }, pressed: { opacity: 0.7 },
});
