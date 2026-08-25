/**
 * @file DiscussionMessage.tsx
 * @description Accessible assistant and user message presentation.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowClockwiseIcon as ArrowClockwise } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { DiscussionMessage as DiscussionMessageModel } from '@/features/discussion/discussion-preview';

export function DiscussionMessage({ message, onRetry }: { message: DiscussionMessageModel; onRetry?(): void }) {
  if (message.role === 'user') {
    return (
      <View accessibilityLabel={`You said: ${message.content}`} style={styles.userWrap}>
        <View style={styles.userBubble}><Text style={styles.userText}>{message.content}</Text></View>
      </View>
    );
  }

  const interrupted = message.status === 'interrupted';
  return (
    <View accessibilityLiveRegion={message.status === 'sending' ? 'polite' : 'none'} style={styles.assistantWrap}>
      <Text style={[styles.assistantName, interrupted && styles.interruptedName]}>{interrupted ? 'INTERRUPTED' : 'HMMMIDEA'}</Text>
      <Text style={[styles.assistantText, interrupted && styles.interruptedText]}>{message.status === 'sending' ? 'Thinking through your idea…' : message.content}</Text>
      {interrupted && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><ArrowClockwise color={colors.ink} size={16} weight="bold" /><Text style={styles.retryText}>Retry</Text></Pressable> : null}
    </View>
  );
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
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, paddingHorizontal: 2 },
  retryText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  pressed: { opacity: 0.65 },
});
