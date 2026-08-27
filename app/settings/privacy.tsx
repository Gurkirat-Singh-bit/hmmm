/**
 * @file privacy.tsx
 * @description Settings route containing the plain-language privacy policy.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts } from '@/constants/theme';

const sections = [
  ['Local by default', 'Your ideas, reports, and job state are stored on your device. Hmmmidea does not require an application account or backend.'],
  ['Provider requests', 'Source audio is sent directly to the speech provider you configure for transcription. Transcripts are sent directly to the AI provider for reports and discussion. Their own privacy terms apply.'],
  ['Protected credentials', 'Provider API keys are stored using your operating system’s protected keychain or keystore and are excluded from data exports.'],
  ['Research consent', 'Research remains available only when you explicitly allow the selected AI provider’s own grounding or search tools to receive a query derived from your transcript and relevant context. You can change this in Settings.'],
  ['Your control', 'You can export non-secret data, turn background completion alerts on or off, delete all ideas while keeping setup, or fully reset the app.'],
  ['What Hmmmidea does not collect', 'The initial architecture has no Hmmmidea account, advertising profile, analytics requirement, or application server receiving your idea library.'],
  ['Audio and generated content', 'Source audio is retained in the app’s local filesystem until you delete its idea or reset the app. Transcripts, reports, discussion messages, and processing state live in the local database.'],
  ['Network boundaries', 'Only the content needed for a requested transcription, analysis, research, or discussion is sent to the provider you selected. Hmmmidea does not proxy those requests through its own backend.'],
  ['Deletion and retention', 'Local content remains on the device until you delete it or remove the app’s data. Provider-side retention is controlled by the provider’s own terms and settings.'],
  ['Exports', 'Exports intentionally omit provider API keys. Review exported content before sharing it because it may contain your profile name, provider choices, models, or future idea content you select.'],
] as const;

export default function PrivacyScreen() {
  return <SettingsSubpage supporting="A concise explanation of what leaves your device and what does not." title="Privacy policy"><View style={styles.list}>{sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}</View></SettingsSubpage>;
}

const styles = StyleSheet.create({ list: { gap: 22 }, section: { gap: 7 }, title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18 }, body: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 } });
