/**
 * @file DiscussionMessage.tsx
 * @description Accessible assistant and user message presentation.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowClockwiseIcon as ArrowClockwise, PlayIcon as Play } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { MessageRecord } from '@/features/domain/contracts';

export function DiscussionMessage({ message, onRetry }: {
  message: MessageRecord;
  onRetry?(mode: 'restart' | 'resume'): void;
}) {
  const waiting = message.role === 'assistant' && (message.status === 'queued' || message.status === 'streaming');
  const retryable = message.role === 'assistant' && (message.status === 'interrupted' || message.status === 'failed');
  const hasPartial = message.role === 'assistant' && Boolean(message.content.trim());
  const responseState = message.role !== 'assistant' ? null : waiting ? 'waiting' : retryable ? message.status : message.status === 'complete' ? 'complete' : null;
  const previousResponseStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousResponseStateRef.current === responseState) return;
    const previousResponseState = previousResponseStateRef.current;
    previousResponseStateRef.current = responseState;
    if (responseState === 'waiting') {
      AccessibilityInfo.announceForAccessibility('Reply is being generated.');
    } else if (responseState === 'interrupted') {
      AccessibilityInfo.announceForAccessibility('Reply paused.');
    } else if (responseState === 'failed') {
      AccessibilityInfo.announceForAccessibility('Reply failed.');
    } else if (responseState === 'complete' && previousResponseState) {
      AccessibilityInfo.announceForAccessibility('Reply ready.');
    }
  }, [responseState]);

  if (message.role === 'user') {
    return <View accessibilityLabel={`You said: ${message.content}`} style={styles.userWrap}>
      <View style={styles.userBubble}><Text style={styles.userText}>{message.content}</Text></View>
    </View>;
  }

  return <View style={styles.assistantWrap}>
    <Text style={[styles.assistantName, retryable && styles.interruptedName]}>{retryable ? 'REPLY PAUSED' : 'HMMMIDEA'}</Text>
    <Text style={[styles.assistantText, retryable && styles.interruptedText]}>{hasPartial ? message.content : waiting ? 'Thinking through your idea…' : 'No response was saved.'}</Text>
    {retryable ? <>
      <Text style={styles.recovery}>{message.error?.message || 'Your saved message is still here.'}</Text>
      {onRetry ? <RetryActions hasPartial={hasPartial} onRetry={onRetry} /> : null}
    </> : null}
  </View>;
}

function RetryActions({ hasPartial, onRetry }: { hasPartial: boolean; onRetry(mode: 'restart' | 'resume'): void }) {
  if (!hasPartial) return <Pressable accessibilityLabel="Retry reply" accessibilityRole="button" onPress={() => onRetry('restart')} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
    <ArrowClockwise color={colors.ink} size={17} weight="bold" /><Text style={styles.retryText}>Retry reply</Text>
  </Pressable>;
  return <View style={styles.retryActions}>
    <Pressable accessibilityLabel="Continue the partial reply" accessibilityRole="button" onPress={() => onRetry('resume')} style={({ pressed }) => [styles.resume, pressed && styles.pressed]}>
      <Play color={colors.inkInverse} size={15} weight="fill" /><Text style={styles.resumeText}>Continue</Text>
    </Pressable>
    <Pressable accessibilityLabel="Restart the reply" accessibilityRole="button" onPress={() => onRetry('restart')} style={({ pressed }) => [styles.restart, pressed && styles.pressed]}>
      <ArrowClockwise color={colors.ink} size={16} weight="bold" /><Text style={styles.restartText}>Start over</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  userWrap: { alignItems: 'flex-end', marginLeft: 42 },
  userBubble: { maxWidth: 310, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.large, borderBottomRightRadius: 8, backgroundColor: colors.primary },
  userText: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14, lineHeight: 21 },
  assistantWrap: { maxWidth: 340, alignItems: 'flex-start' },
  assistantName: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 0.85 },
  interruptedName: { color: colors.danger },
  assistantText: { marginTop: 5, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 15, lineHeight: 23 },
  interruptedText: { color: colors.inkMuted },
  recovery: { marginTop: 7, color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 12, lineHeight: 17 },
  retryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  retry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  resume: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.ink },
  restart: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill },
  retryText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  resumeText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  restartText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  pressed: { opacity: 0.65 },
});
