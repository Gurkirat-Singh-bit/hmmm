/**
 * @file DiscussionComposer.tsx
 * @description Keyboard-safe multiline composer and discussion availability notice.
 * @author Gurkirat Singh
 * @license MIT
 */

import { PaperPlaneTiltIcon as PaperPlaneTilt } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { DiscussionAvailability } from '@/features/discussion/discussion-service';

export function DiscussionComposer({
  availability,
  sending,
  value,
  onChange,
  onSend,
}: {
  availability: DiscussionAvailability;
  sending: boolean;
  value: string;
  onChange(value: string): void;
  onSend(): void;
}) {
  const unavailable = availability !== 'ready';
  const disabled = unavailable || sending || value.trim().length === 0;

  return (
    <View style={styles.shell}>
      {availability === 'offline' ? <AvailabilityNotice text="Offline. Read saved messages and keep drafting, then send when you reconnect." /> : null}
      {availability === 'missing-provider' ? <AvailabilityNotice text="Add an AI provider to send this saved draft." /> : null}
      <View style={[styles.composer, unavailable && styles.composerDisabled]}>
        <TextInput
          accessibilityLabel="Message about this idea"
          autoCorrect
          editable
          maxLength={1200}
          multiline
          onChangeText={onChange}
          placeholder="Ask about this idea…"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="default"
          scrollEnabled
          style={styles.input}
          textAlignVertical="top"
          value={value}
        />
        <Pressable
          accessibilityLabel={sending ? 'Sending message' : 'Send message'}
          accessibilityRole="button"
          accessibilityState={{ busy: sending, disabled }}
          disabled={disabled}
          onPress={onSend}
          style={({ pressed }) => [styles.send, disabled && styles.sendDisabled, pressed && styles.pressed]}
        >
          {sending ? <ActivityIndicator color={colors.inkInverse} size="small" /> : <PaperPlaneTilt color={colors.inkInverse} size={19} weight="fill" />}
        </Pressable>
      </View>
    </View>
  );
}

function AvailabilityNotice({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  shell: { gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.canvas },
  notice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.medium, backgroundColor: colors.happySoft },
  noticeText: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 11, lineHeight: 16 },
  composer: { minHeight: 56, maxHeight: 132, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 22, backgroundColor: colors.canvasSoft },
  composerDisabled: { backgroundColor: colors.surfaceMuted },
  input: { flex: 1, minHeight: 44, maxHeight: 116, paddingTop: 11, paddingBottom: 10, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  send: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.ink },
  sendDisabled: { opacity: 0.28 },
  pressed: { opacity: 0.7 },
});
