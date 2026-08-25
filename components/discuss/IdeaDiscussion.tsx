/**
 * @file IdeaDiscussion.tsx
 * @description Complete local-preview conversation experience for one idea.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowLeftIcon as ArrowLeft } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscussionComposer } from '@/components/discuss/DiscussionComposer';
import { DiscussionMessage } from '@/components/discuss/DiscussionMessage';
import { DiscussionPromptChips } from '@/components/discuss/DiscussionPromptChips';
import { IdeaContextStrip } from '@/components/discuss/IdeaContextStrip';
import { ReportUpdateProposal, type ProposalDecision } from '@/components/discuss/ReportUpdateProposal';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { DiscussionMessage as DiscussionMessageModel, DiscussionThreadPreview } from '@/features/discussion/discussion-preview';
import type { IdeaReport, VaultIdea } from '@/features/vault/vault-preview';

const PREVIEW_REPLY = 'Make the next move small enough to finish, but specific enough to teach you whether the idea has energy.';

export function IdeaDiscussion({ idea, report, thread }: { idea: VaultIdea; report: IdeaReport; thread: DiscussionThreadPreview }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composer, setComposer] = useState('');
  const [messages, setMessages] = useState<DiscussionMessageModel[]>(() => [...thread.messages]);
  const [proposalDecision, setProposalDecision] = useState<ProposalDecision>('pending');
  const sending = messages.some((message) => message.status === 'sending');

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const finishReply = (messageId: string) => {
    timerRef.current = setTimeout(() => {
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: PREVIEW_REPLY, status: 'sent' } : message));
      timerRef.current = null;
    }, 900);
  };

  const send = () => {
    const content = composer.trim();
    if (!content || sending || thread.availability !== 'ready') return;
    const id = Date.now().toString();
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const replyId = `${id}-reply`;
    setMessages((current) => [...current, { id, role: 'user', content, time, status: 'sent' }, { id: replyId, role: 'assistant', content: '', time, status: 'sending' }]);
    setComposer('');
    finishReply(replyId);
  };

  const retry = (messageId: string) => {
    if (sending || thread.availability !== 'ready') return;
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: '', status: 'sending' } : message));
    finishReply(messageId);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={styles.keyboard}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to Discuss" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.circle, pressed && styles.pressed]}><ArrowLeft color={colors.ink} size={21} weight="bold" /></Pressable>
          <View style={styles.headerCopy}><Text numberOfLines={1} accessibilityRole="header" style={styles.title}>{idea.title}</Text><Text style={styles.saved}>Saved locally</Text></View>
          <Pressable accessibilityLabel="View idea" accessibilityRole="button" onPress={() => router.push(`/vault/${idea.id}`)} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}><Text style={styles.reportText}>View idea</Text></Pressable>
        </View>

        <IdeaContextStrip gist={report.gist} />

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? <ConversationEmpty /> : messages.map((message) => <DiscussionMessage key={message.id} message={message} onRetry={message.status === 'interrupted' ? () => retry(message.id) : undefined} />)}
          {thread.updateProposal ? <ReportUpdateProposal decision={proposalDecision} onApply={() => setProposalDecision('applied')} onKeep={() => setProposalDecision('kept')} proposal={thread.updateProposal} /> : null}
        </ScrollView>

        {messages.length === 0 ? <DiscussionPromptChips disabled={thread.availability !== 'ready' || sending} onChoose={setComposer} /> : null}
        <DiscussionComposer availability={thread.availability} onChange={setComposer} onSend={send} sending={sending} value={composer} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConversationEmpty() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Start with what feels uncertain.</Text>
      <Text style={styles.emptyBody}>Ask a question or choose a prompt.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  keyboard: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  circle: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 23, backgroundColor: colors.canvas },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 16 },
  saved: { marginTop: 2, color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 10 },
  reportButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  reportText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  messages: { flexGrow: 1, gap: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  empty: { padding: 20, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 18 },
  emptyBody: { marginTop: 6, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.65 },
});
