import { CaretDown, Check, MagnifyingGlass, X } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

export function SearchableModelPicker({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const cleanQuery = query.trim();
  const filtered = useMemo(() => {
    const normalized = cleanQuery.toLowerCase();
    return normalized ? options.filter((option) => option.toLowerCase().includes(normalized)) : options;
  }, [cleanQuery, options]);
  const custom = Boolean(cleanQuery && !options.some((option) => option.toLowerCase() === cleanQuery.toLowerCase()));

  const choose = (model: string) => {
    onChange(model);
    setQuery('');
    setOpen(false);
  };

  return (
    <>
      <View style={styles.group}>
        <Text style={styles.label}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
          <View style={styles.triggerCopy}>
            <Text numberOfLines={1} style={styles.value}>{value}</Text>
            <Text style={styles.hint}>Tap to search or enter a model ID</Text>
          </View>
          <CaretDown color={colors.darkMuted} size={18} weight="bold" />
        </Pressable>
      </View>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} visible={open}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <View><Text style={styles.modalKicker}>MODEL CATALOG</Text><Text style={styles.modalTitle}>Choose a model</Text></View>
            <Pressable accessibilityLabel="Close model picker" onPress={() => setOpen(false)} style={styles.close}><X color={colors.ink} size={20} weight="bold" /></Pressable>
          </View>
          <View style={styles.search}>
            <MagnifyingGlass color={colors.inkMuted} size={19} weight="bold" />
            <TextInput autoCapitalize="none" autoCorrect={false} autoFocus onChangeText={setQuery} placeholder="Search model or paste exact ID" placeholderTextColor={colors.inkMuted} style={styles.searchInput} value={query} />
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={custom ? [cleanQuery, ...filtered] : filtered}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No matching model.</Text><Text style={styles.emptyBody}>Paste the exact model ID above to use a custom model.</Text></View>}
            renderItem={({ item, index }) => {
              const selected = item === value;
              const isCustom = custom && index === 0;
              return (
                <Pressable onPress={() => choose(item)} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
                  <View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowValue}>{item}</Text>{isCustom ? <Text style={styles.custom}>USE CUSTOM MODEL ID</Text> : null}</View>
                  {selected ? <Check color={colors.ink} size={18} weight="bold" /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 }, label: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  trigger: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkSurface },
  triggerCopy: { flex: 1, gap: 3 }, value: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 }, hint: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10 }, pressed: { opacity: 0.7 },
  modal: { flex: 1, backgroundColor: colors.canvas }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.page, paddingTop: 12, paddingBottom: 18 },
  modalKicker: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1.2 }, modalTitle: { marginTop: 5, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 25 },
  close: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.surfaceMuted },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.page, paddingHorizontal: 16, borderRadius: radii.medium, backgroundColor: colors.surfaceMuted },
  searchInput: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 15 }, list: { paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 32 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowSelected: { borderBottomColor: colors.primary, borderRadius: radii.medium, backgroundColor: colors.primarySoft }, rowCopy: { flex: 1, gap: 4 }, rowValue: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 }, custom: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 8, letterSpacing: 0.8 },
  empty: { gap: 6, paddingVertical: 36 }, emptyTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 }, emptyBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
});
