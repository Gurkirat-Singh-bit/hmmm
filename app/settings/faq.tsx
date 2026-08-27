/**
 * @file faq.tsx
 * @description Settings route with expandable answers to common app questions.
 * @author Gurkirat Singh
 * @license MIT
 */

import { CaretDownIcon as CaretDown } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsSubpage } from '@/components/settings/SettingsSubpage';
import { colors, onboardingFonts, radii } from '@/constants/theme';

const questions = [
  { question: 'Where are my ideas stored?', answer: 'Your ideas stay on this device. The app does not require a Hmmmidea account or backend.' },
  { question: 'Why do I need provider keys?', answer: 'Your chosen speech and AI providers process transcription and generated reports directly. Keys are stored in versioned Android protected credential storage, never in the app database or exports.' },
  { question: 'Can I change providers later?', answer: 'Yes. Open Providers & models from Settings whenever you want to replace a provider, model, endpoint, or key.' },
  { question: 'Does Hmmmidea require an account?', answer: 'No. The initial app has no required Hmmmidea account, application backend, or cloud sync. Your device is the source of truth.' },
  { question: 'What happens when a provider request fails?', answer: 'Your local capture should remain safe. Failed transcription or analysis work can be retried after checking the provider key, model, endpoint, or network connection.' },
  { question: 'Are my API keys included in exports?', answer: 'No. API keys are deliberately excluded from exports and ordinary logs. They remain in protected device credential storage.' },
  { question: 'What can research send to my provider?', answer: 'Only after you allow it, Hmmmidea can send a query derived from your transcript and relevant transcript context to your chosen AI provider’s own grounding or search tools. You can withdraw that consent in Settings.' },
  { question: 'Can I remove ideas without losing my setup?', answer: 'Yes. Data controls lets you delete ideas and retained audio while keeping provider choices and credentials. Full reset removes ideas, preferences, and every versioned credential slot.' },
  { question: 'Can I use a custom provider?', answer: 'Yes. Choose Custom, enter a compatible base URL, provide its key, and select or enter the exact model ID expected by that endpoint.' },
  { question: 'What does the activity chart represent?', answer: 'It is the UI for a seven-day capture summary. It will use locally recorded capture counts when the recording and database layer are connected.' },
] as const;

export default function FaqScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return <SettingsSubpage supporting="Quick answers about privacy, providers, and your local data." title="FAQ"><View style={styles.list}>{questions.map((item, index) => { const expanded = open === index; return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} key={item.question} onPress={() => setOpen(expanded ? null : index)} style={styles.card}><View style={styles.questionRow}><Text style={styles.question}>{item.question}</Text><CaretDown color={colors.inkMuted} size={18} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} weight="bold" /></View>{expanded ? <Text style={styles.answer}>{item.answer}</Text> : null}</Pressable>; })}</View></SettingsSubpage>;
}

const styles = StyleSheet.create({
  list: { gap: 10 }, card: { padding: 18, borderRadius: radii.large, backgroundColor: colors.canvas }, questionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  question: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 15 }, answer: { marginTop: 12, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20 },
});
