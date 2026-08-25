/**
 * @file DiscussionList.tsx
 * @description Discussion summaries and ready-idea entry rows.
 * @author Gurkirat Singh
 * @license MIT
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyPanel } from '@/components/EmptyPanel';
import { IdeaVaultRow } from '@/components/vault/IdeaVaultList';
import { colors, onboardingFonts } from '@/constants/theme';
import type { DiscussionThreadSummary } from '@/features/discussion/discussion-preview';
import type { VaultIdea } from '@/features/vault/vault-preview';

export function DiscussionList({
  ideas,
  onOpen,
  threads,
}: {
  ideas: readonly VaultIdea[];
  onOpen(ideaId: string): void;
  threads: readonly DiscussionThreadSummary[];
}) {
  return (
    <View style={styles.sections}>
      <View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Continue Discussion</Text>
        {threads.length > 0 ? (
          <View style={styles.threadList}>
            {threads.map((thread) => <ThreadRow key={thread.ideaId} onOpen={onOpen} thread={thread} title={ideas.find((idea) => idea.id === thread.ideaId)?.title ?? 'Saved idea'} />)}
          </View>
        ) : <View style={styles.emptyGap}><EmptyPanel body="Start with any ready idea below. Its conversation will appear here." title="No conversations yet." /></View>}
      </View>

      <View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Start from an idea</Text>
        {ideas.length > 0 ? (
          <View style={styles.ideaList}>
            {ideas.map((idea) => <IdeaVaultRow idea={idea} key={idea.id} onOpen={onOpen} />)}
          </View>
        ) : <View style={styles.emptyGap}><EmptyPanel body="Once a capture finishes processing, you can open its report or discuss it here." title="No ready ideas yet." /></View>}
      </View>
    </View>
  );
}

function ThreadRow({ onOpen, thread, title }: { onOpen(ideaId: string): void; thread: DiscussionThreadSummary; title: string }) {
  return (
    <Pressable
      accessibilityHint="Opens this idea conversation"
      accessibilityLabel={`${title}, ${thread.messageCount} messages, updated ${thread.time} ago`}
      accessibilityRole="button"
      onPress={() => onOpen(thread.ideaId)}
      style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <View style={styles.titleLine}><Text numberOfLines={1} style={styles.rowTitle}>{title}</Text><Text style={styles.time}>{thread.time}</Text></View>
        <Text numberOfLines={1} style={styles.preview}>{thread.lastMessage}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 30 },
  sectionTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 21, letterSpacing: -0.35 },
  threadList: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  threadRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  copy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 15, lineHeight: 19 },
  time: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 10 },
  preview: { marginTop: 3, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 12, lineHeight: 17 },
  ideaList: { gap: 8, marginTop: 12 },
  emptyGap: { marginTop: 14 },
  pressed: { opacity: 0.7 },
});
