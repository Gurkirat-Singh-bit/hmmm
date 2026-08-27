import { MagnifyingGlassIcon as Search } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CaptureSort } from '@/features/database/contracts';
import type { CaptureStatus } from '@/features/domain/contracts';
import { colors, onboardingFonts, radii } from '@/constants/theme';
import type { VaultFilters } from '@/features/vault/vault-preferences';

const processing: readonly CaptureStatus[] = ['queued', 'transcribing', 'naming', 'researching'];
const statusFilters: readonly { label: string; statuses: readonly CaptureStatus[] }[] = [
  { label: 'All', statuses: [] },
  { label: 'Processing', statuses: processing },
  { label: 'Ready', statuses: ['ready'] },
  { label: 'Failed', statuses: ['failed'] },
];
const sortOptions: readonly { value: CaptureSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title-asc', label: 'A–Z' },
  { value: 'title-desc', label: 'Z–A' },
];

function sameStatuses(left: readonly CaptureStatus[], right: readonly CaptureStatus[]) {
  return left.length === right.length && left.every((status) => right.includes(status));
}

export function VaultToolbar({ filters, onFiltersChange, onQueryChange, query }: {
  filters: VaultFilters;
  onFiltersChange(next: VaultFilters): void;
  onQueryChange(value: string): void;
  query: string;
}) {
  const setStatuses = (statuses: readonly CaptureStatus[]) => onFiltersChange({ ...filters, statuses });
  return (
    <View style={styles.toolbar}>
      <View style={styles.search}>
        <Search color={colors.inkMuted} size={19} weight="bold" />
        <TextInput
          accessibilityLabel="Search ideas by title, summary, or original words"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onQueryChange}
          placeholder="Search your ideas"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
      </View>

      <View accessibilityLabel="Starred ideas filter" accessibilityRole="radiogroup" style={styles.chips}>
        <FilterChip active={!filters.starredOnly} label="All ideas" onPress={() => onFiltersChange({ ...filters, starredOnly: false })} />
        <FilterChip active={filters.starredOnly} label="Starred" onPress={() => onFiltersChange({ ...filters, starredOnly: true })} />
      </View>

      <View accessibilityLabel="Idea status filter" accessibilityRole="radiogroup" style={styles.chips}>
        {statusFilters.map((filter) => <FilterChip
          active={sameStatuses(filters.statuses, filter.statuses)}
          key={filter.label}
          label={filter.label}
          onPress={() => setStatuses(filter.statuses)}
        />)}
      </View>

      <View accessibilityLabel="Sort ideas" accessibilityRole="radiogroup" style={styles.sorts}>
        <Text style={styles.sortLabel}>Sort</Text>
        <View style={styles.sortOptions}>
          {sortOptions.map((option) => <FilterChip
            active={filters.sort === option.value}
            key={option.value}
            label={option.label}
            onPress={() => onFiltersChange({ ...filters, sort: option.value })}
          />)}
        </View>
      </View>
    </View>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress(): void }) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: active }}
    onPress={onPress}
    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
  ><Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  toolbar: { gap: 10, marginTop: 22 },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, backgroundColor: colors.canvas },
  input: { flex: 1, minHeight: 48, color: colors.ink, fontFamily: onboardingFonts.bodyRegular, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary },
  chipLabel: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 },
  chipLabelActive: { color: colors.ink, fontFamily: onboardingFonts.bodyBold },
  sorts: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2 },
  sortLabel: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 11 },
  sortOptions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.62 },
});
