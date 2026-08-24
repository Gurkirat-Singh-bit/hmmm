/**
 * @file SearchableModelPicker.tsx
 * @description Searchable modal control for selecting or entering provider models.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArrowClockwiseIcon as ArrowClockwise,
  CaretDownIcon as CaretDown,
  CheckIcon as Check,
  MagnifyingGlassIcon as MagnifyingGlass,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

export function SearchableModelPicker({ error, label, light = false, loading, options, value, onChange, onRefresh }: {
  error?: string | null;
  label: string;
  light?: boolean;
  loading?: boolean;
  options: readonly string[];
  value: string;
  onChange(value: string): void;
  onRefresh?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const cleanQuery = query.trim();
  const filtered = useMemo(() => {
    const normalized = cleanQuery.toLowerCase();
    return normalized ? options.filter((option) => option.toLowerCase().includes(normalized)) : options;
  }, [cleanQuery, options]);
  const custom = Boolean(cleanQuery && !options.some((option) => option.toLowerCase() === cleanQuery.toLowerCase()));
  const visibleOptions = !cleanQuery && value && filtered.includes(value)
    ? [value, ...filtered.filter((option) => option !== value)]
    : filtered;

  const choose = (model: string) => {
    onChange(model);
    setQuery('');
    setOpen(false);
  };

  return (
    <>
      <View style={styles.group}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, light && styles.lightMutedText]}>{label}</Text>
          {onRefresh ? <Pressable accessibilityLabel="Sync model catalog" disabled={loading} onPress={onRefresh} style={({ pressed }) => [styles.syncButton, pressed && styles.pressed]}>
            <ArrowClockwise color={colors.darkMuted} size={13} weight="bold" />
            <Text style={styles.syncText}>{loading ? 'SYNCING' : 'SYNC CATALOG'}</Text>
          </Pressable> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, light && styles.triggerLight, pressed && styles.pressed]}>
          <View style={styles.triggerCopy}>
            <Text numberOfLines={1} style={[styles.value, light && styles.lightText, !value && styles.placeholder]}>{value || 'Choose a model'}</Text>
            <Text numberOfLines={1} style={[styles.hint, light && styles.lightMutedText]}>{loading ? 'Loading current models…' : `${options.length} models available · Tap to search`}</Text>
          </View>
          <CaretDown color={colors.darkMuted} size={18} weight="bold" />
        </Pressable>
        {error ? <View accessibilityRole="alert" style={styles.errorMessage}>
          <WarningCircle color={colors.danger} size={16} weight="fill" />
          <Text style={styles.errorText}>{error}</Text>
        </View> : null}
      </View>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} visible={open}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <View><Text style={styles.modalKicker}>MODEL CATALOG · {options.length}</Text><Text style={styles.modalTitle}>Choose a model</Text></View>
            <Pressable accessibilityLabel="Close model picker" onPress={() => setOpen(false)} style={styles.close}><X color={colors.ink} size={20} weight="bold" /></Pressable>
          </View>
          <View style={styles.search}>
            <MagnifyingGlass color={colors.inkMuted} size={19} weight="bold" />
            <TextInput autoCapitalize="none" autoCorrect={false} autoFocus onChangeText={setQuery} placeholder="Search model or paste exact ID" placeholderTextColor={colors.inkMuted} style={styles.searchInput} value={query} />
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={custom ? [cleanQuery, ...visibleOptions] : visibleOptions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item}
            ListEmptyComponent={<View style={styles.empty}>{loading ? <ActivityIndicator color={colors.ink} /> : null}<Text style={styles.emptyTitle}>{loading ? 'Loading models…' : 'No matching model.'}</Text><Text style={styles.emptyBody}>{error ?? 'Type or paste an exact model ID above to use it.'}</Text></View>}
            renderItem={({ item, index }) => {
              const selected = item === value;
              const isCustom = custom && index === 0;
              return (
                <Pressable onPress={() => choose(item)} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={2} style={styles.rowValue}>{item}</Text>
                    {isCustom ? <Text style={styles.custom}>USE CUSTOM MODEL ID</Text> : selected ? <Text style={styles.custom}>SELECTED MODEL</Text> : null}
                  </View>
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
  group: { gap: 9 }, labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, label: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  syncButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.darkCanvas },
  syncText: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 8, letterSpacing: 0.6 },
  trigger: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkCanvas },
  triggerCopy: { flex: 1, gap: 3 }, value: { color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 }, placeholder: { color: colors.darkMuted }, hint: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 10 }, pressed: { opacity: 0.7 },
  errorMessage: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.small, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyMedium, fontSize: 10, lineHeight: 15 },
  modal: { flex: 1, backgroundColor: colors.canvas }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.page, paddingTop: 12, paddingBottom: 18 },
  modalKicker: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1.2 }, modalTitle: { marginTop: 5, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 25 },
  close: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.surfaceMuted },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.page, paddingHorizontal: 16, borderRadius: radii.medium, backgroundColor: colors.surfaceMuted },
  searchInput: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 15 }, list: { paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 32 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowSelected: { borderBottomColor: colors.primary, borderRadius: radii.medium, backgroundColor: colors.primarySoft }, rowCopy: { flex: 1, gap: 4 }, rowValue: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 }, custom: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 8, letterSpacing: 0.8 },
  empty: { gap: 6, paddingVertical: 36 }, emptyTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 17 }, emptyBody: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  triggerLight: { borderColor: colors.line, backgroundColor: colors.canvas }, lightText: { color: colors.ink }, lightMutedText: { color: colors.inkMuted },
});
