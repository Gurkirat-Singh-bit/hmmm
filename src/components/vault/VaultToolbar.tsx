/**
 * @file VaultToolbar.tsx
 * @description Search and status filters for Vault ideas.
 * @author Gurkirat Singh
 * @license MIT
 */

import { MagnifyingGlassIcon as Search } from "phosphor-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { CaptureStatus } from "@/features/domain/contracts";
import type { VaultFilters } from "@/features/vault/vault-preferences";

type StatusFilter = "all" | "ready" | "processing";

const processing: readonly CaptureStatus[] = [
  "queued",
  "transcribing",
  "naming",
  "researching",
];
const filters = [
  { id: "latest", label: "Latest" },
  { id: "starred", label: "Starred" },
] as const;
const statuses: { id: StatusFilter; label: string; supporting: string }[] = [
  {
    id: "all",
    label: "All statuses",
    supporting: "Ready and processing ideas",
  },
  { id: "ready", label: "Ready", supporting: "Completed idea reports" },
  {
    id: "processing",
    label: "Processing",
    supporting: "Ideas still being structured",
  },
];
export function VaultToolbar({
  filters: value,
  onFiltersChange,
  onQueryChange,
  query,
}: {
  filters: VaultFilters;
  onFiltersChange(next: VaultFilters): void;
  onQueryChange(value: string): void;
  query: string;
}) {
  const [open, setOpen] = useState(false);
  const status = selectedStatus(value.statuses);
  const setFilter = (filter: (typeof filters)[number]["id"]) =>
    onFiltersChange({
      ...value,
      sort: "newest",
      starredOnly: filter === "starred",
    });
  const setStatus = (next: StatusFilter) =>
    onFiltersChange({
      ...value,
      statuses:
        next === "ready" ? ["ready"] : next === "processing" ? processing : [],
    });
  return (
    <View style={styles.toolbar}>
      <View style={styles.search}>
        <Search color={colors.inkMuted} size={17} weight="bold" />
        <TextInput
          autoCapitalize="none"
          onChangeText={onQueryChange}
          placeholder="Search ideas"
          placeholderTextColor={colors.inkMuted}
          style={styles.input}
          value={query}
        />
      </View>
      <View style={styles.filters}>
        {filters.map(({ id, label }) => {
          const active = id === (value.starredOnly ? "starred" : "latest");
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              key={id}
              onPress={() => setFilter(id)}
              style={({ pressed }) => [
                styles.filter,
                active && styles.filterActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.filterLabel, active && styles.filterLabelActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={[
            styles.filter,
            styles.filterMenu,
            status !== "all" && styles.statusActive,
          ]}
        >
          <Text
            style={[styles.filterLabel, status !== "all" && styles.statusLabel]}
          >
            {status === "all"
              ? "Filter"
              : status === "ready"
                ? "Ready"
                : "Processing"}
          </Text>
        </Pressable>
      </View>
      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable onPress={() => setOpen(false)} style={styles.backdrop}>
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <Pressable>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Filter ideas</Text>
              <Text style={styles.sheetBody}>
                Show ideas by processing status.
              </Text>
              <View style={styles.statuses}>
                {statuses.map((item) => {
                  const active = item.id === status;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      key={item.id}
                      onPress={() => {
                        setStatus(item.id);
                        setOpen(false);
                      }}
                      style={[
                        styles.statusRow,
                        active && styles.statusRowActive,
                      ]}
                    >
                      <View style={styles.statusCopy}>
                        <Text style={styles.statusTitle}>{item.label}</Text>
                        <Text style={styles.statusSupporting}>
                          {item.supporting}
                        </Text>
                      </View>
                      <View
                        style={[styles.radio, active && styles.radioActive]}
                      >
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}
function selectedStatus(statuses: readonly CaptureStatus[]): StatusFilter {
  if (statuses.length === 1 && statuses[0] === "ready") return "ready";
  if (
    statuses.length === processing.length &&
    processing.every((status) => statuses.includes(status))
  )
    return "processing";
  return "all";
}

const styles = StyleSheet.create({
  toolbar: { gap: 10, marginTop: 22 },
  search: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    includeFontPadding: false,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  filters: { flexDirection: "row", gap: 8 },
  filter: {
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  filterMenu: { marginLeft: "auto" },
  filterActive: { backgroundColor: colors.ink },
  filterLabel: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 10,
  },
  filterLabelActive: { color: colors.inkInverse },
  pressed: { opacity: 0.68 },
  statusActive: { backgroundColor: colors.primary },
  statusLabel: { color: colors.ink },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28,28,28,0.28)",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopLeftRadius: radii.panel,
    borderTopRightRadius: radii.panel,
    backgroundColor: colors.canvas,
  },
  handle: {
    width: 38,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  sheetTitle: {
    marginTop: 20,
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 24,
  },
  sheetBody: {
    marginTop: 4,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
  },
  statuses: { gap: 8, marginTop: 18, marginBottom: 12 },
  statusRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderRadius: radii.medium,
    backgroundColor: colors.canvasSoft,
  },
  statusRowActive: { backgroundColor: colors.primarySoft },
  statusCopy: { flex: 1, gap: 2 },
  statusTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 14,
  },
  statusSupporting: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 10,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: 10,
  },
  radioActive: { borderColor: colors.ink },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
});
