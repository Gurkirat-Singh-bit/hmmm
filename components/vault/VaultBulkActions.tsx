import { ExportIcon as Export, TrashIcon as Trash } from 'phosphor-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, onboardingFonts, radii } from '@/constants/theme';

export function VaultBulkActions({ count, onCancel, onDelete, onShare, pending }: {
  count: number;
  onCancel(): void;
  onDelete(): Promise<void>;
  onShare(): Promise<void>;
  pending: boolean;
}) {
  const confirmDelete = () => Alert.alert(
    count === 1 ? 'Delete this idea?' : `Delete ${count} ideas?`,
    'Their reports, discussions, queued work, and retained audio will be removed from this device.',
    [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void onDelete() },
    ],
  );
  return <View style={styles.wrap}>
    <Text accessibilityLiveRegion="polite" style={styles.count}>{count === 1 ? '1 idea selected' : `${count} ideas selected`}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={pending} onPress={() => void onShare()} style={({ pressed }) => [styles.action, pressed && styles.pressed, pending && styles.disabled]}><Export color={colors.ink} size={19} weight="bold" /><Text style={styles.actionText}>Share text</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={pending} onPress={confirmDelete} style={({ pressed }) => [styles.action, styles.delete, pressed && styles.pressed, pending && styles.disabled]}><Trash color={colors.ink} size={19} weight="bold" /><Text style={styles.actionText}>Delete</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={pending} onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 20, padding: 14, borderRadius: radii.large, backgroundColor: colors.primarySoft },
  count: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.canvas },
  delete: { backgroundColor: colors.happySoft },
  actionText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  cancelText: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.45 },
});
