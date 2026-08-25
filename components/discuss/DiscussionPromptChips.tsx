/**
 * @file DiscussionPromptChips.tsx
 * @description Starter prompts for common idea discussion intents.
 * @author Gurkirat Singh
 * @license MIT
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';
import { discussionPromptSuggestions } from '@/features/discussion/discussion-preview';

export function DiscussionPromptChips({ disabled, onChoose }: { disabled: boolean; onChoose(prompt: string): void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>TRY A DIRECTION</Text>
      <ScrollView contentContainerStyle={styles.chips} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
        {discussionPromptSuggestions.map((suggestion) => (
          <Pressable
            accessibilityHint={`Adds “${suggestion.prompt}” to the message field`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            key={suggestion.id}
            onPress={() => onChoose(suggestion.prompt)}
            style={({ pressed }) => [styles.chip, disabled && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{suggestion.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { paddingHorizontal: 20, color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 0.9 },
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill, backgroundColor: colors.canvas },
  chipText: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { backgroundColor: colors.primarySoft },
});
