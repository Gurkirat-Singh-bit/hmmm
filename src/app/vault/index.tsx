/**
 * @file index.tsx
 * @description Vault route for searching, filtering, selecting, and opening local ideas.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IdeaVaultList } from "@/components/vault/IdeaVaultList";
import { VaultCollectionState } from "@/components/vault/VaultCollectionState";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { VaultToolbar } from "@/components/vault/VaultToolbar";
import { colors, onboardingFonts, spacing } from "@/constants/theme";
import { useVaultCollection } from "@/features/vault/use-vault-collection";
export default function VaultScreen() {
  const router = useRouter();
  const vault = useVaultCollection();
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      deleteArmedId &&
      !vault.captures.some((capture) => capture.id === deleteArmedId)
    )
      setDeleteArmedId(null);
  }, [deleteArmedId, vault.captures]);
  const remove = async (capture: (typeof vault.captures)[number]) => {
    setDeletingId(capture.id);
    setNotice(null);
    try {
      await vault.actions.remove([capture]);
      setDeleteArmedId(null);
      setNotice("Idea deleted from this device.");
    } catch {
      setNotice("Could not delete this idea. Try again.");
    } finally {
      setDeletingId(null);
    }
  };
  const hasFilters = Boolean(
    vault.query.trim() ||
    vault.filters.starredOnly ||
    vault.filters.statuses.length ||
    vault.filters.sort !== "newest",
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VaultHeader count={vault.captures.length} />
        <VaultToolbar
          filters={vault.filters}
          onFiltersChange={vault.setFilters}
          onQueryChange={vault.setQuery}
          query={vault.query}
        />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        {vault.loading ? <VaultCollectionState kind="loading" /> : null}
        {!vault.loading && vault.error ? (
          <VaultCollectionState kind="error" onRetry={vault.actions.refresh} />
        ) : null}
        {!vault.loading && !vault.error && !vault.captures.length ? (
          <VaultCollectionState
            kind={hasFilters ? "no-results" : "empty"}
            onRetry={vault.actions.refresh}
            onStartCapture={() => router.push("/")}
          />
        ) : null}
        {!vault.loading && !vault.error && vault.captures.length ? (
          <IdeaVaultList
            captures={vault.captures}
            deleteArmedId={deleteArmedId}
            deletingId={deletingId}
            onDelete={(capture) => void remove(capture)}
            onDeleteIntent={setDeleteArmedId}
            onOpen={(id) => router.push(`/vault/${id}`)}
            onToggleStar={(capture) => void vault.actions.toggleStar(capture)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 14,
    paddingBottom: 112,
  },
  notice: {
    marginTop: 14,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 18,
  },
});
