import { CheckSquareIcon as CheckSquare } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MainBrandHeader } from '@/components/MainBrandHeader';
import { colors, onboardingFonts, radii } from '@/constants/theme';

export function VaultHeader({ count, selecting, onToggleSelecting }: {
  count: number;
  selecting: boolean;
  onToggleSelecting(): void;
}) {
  return (
    <View>
      <MainBrandHeader />
      <View style={styles.heading}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>Vault</Text>
          <Text style={styles.count}>{count === 1 ? '1 idea' : `${count} ideas`}</Text>
        </View>
        <Pressable
          accessibilityLabel={selecting ? 'Stop selecting ideas' : 'Select ideas'}
          accessibilityRole="button"
          onPress={onToggleSelecting}
          style={({ pressed }) => [styles.select, selecting && styles.selectActive, pressed && styles.pressed]}
        >
          <CheckSquare color={colors.ink} size={18} weight={selecting ? 'fill' : 'bold'} />
          <Text style={styles.selectLabel}>{selecting ? 'Done' : 'Select'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { minHeight: 58, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22 },
  title: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 30, letterSpacing: -0.8 },
  count: { marginTop: 2, color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 12 },
  select: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  selectActive: { backgroundColor: colors.primary },
  selectLabel: { color: colors.ink, fontFamily: onboardingFonts.bodyBold, fontSize: 12 },
  pressed: { opacity: 0.64 },
});
