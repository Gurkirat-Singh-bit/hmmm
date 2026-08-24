/**
 * @file how-to-use.tsx
 * @description Short product guide covering the core Hmmmidea workflow.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const steps = [
  ['1', 'Configure your providers', 'Open Settings → Providers & models. Choose one speech provider and one AI provider, add their API keys, select models, then save.'],
  ['2', 'Capture the thought', 'Open Home and start recording. Speak naturally; do not stop to organize, title, or polish the idea while it is arriving.'],
  ['3', 'Pause or finish safely', 'Pause when interrupted and resume when ready. Finish the recording when the thought is safe. The original capture remains the source material.'],
  ['4', 'Let Hmmmidea shape it', 'The configured speech model creates a transcript. The AI model turns that transcript into a structured report with the gist, evidence, risks, and a next move.'],
  ['5', 'Find it in the Vault', 'Use the Vault to search and revisit saved ideas. Open an idea to review its report without losing the wording and context of the original thought.'],
  ['6', 'Discuss, refine, and share', 'Use Discuss to challenge assumptions or develop the next step. Changes remain deliberate, and useful results can be exported or shared.'],
] as const;

export default function HowToUseScreen() {
  return <SettingsSubpage supporting="From an unpolished voice note to a useful, searchable idea without creating an account." title="How to use Hmmmidea"><View style={styles.notice}><Text style={styles.noticeTitle}>The simple rule</Text><Text style={styles.noticeBody}>Capture first. Organize later. Hmmmidea is designed to keep the recording step intentionally low-friction.</Text></View><View style={styles.list}>{steps.map(([number, title, body]) => <View key={number} style={styles.step}><View style={styles.number}><Text style={styles.numberText}>{number}</Text></View><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View></View>)}</View></SettingsSubpage>;
}

const styles = StyleSheet.create({ notice: { gap: 5, marginBottom: 14, padding: 16, borderRadius: radii.large, backgroundColor: colors.calmSoft }, noticeTitle: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 14 }, noticeBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 }, list: { gap: 12 }, step: { flexDirection: 'row', gap: 13, padding: 16, borderRadius: radii.large, backgroundColor: colors.canvas }, number: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.primary }, numberText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 }, copy: { flex: 1, gap: 4 }, title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 }, body: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 } });
