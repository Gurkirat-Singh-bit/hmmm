import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IdeaVaultList } from '@/components/vault/IdeaVaultList';
import { VaultBulkActions } from '@/components/vault/VaultBulkActions';
import { VaultCollectionState } from '@/components/vault/VaultCollectionState';
import { VaultHeader } from '@/components/vault/VaultHeader';
import { VaultToolbar } from '@/components/vault/VaultToolbar';
import { colors, onboardingFonts, spacing } from '@/constants/theme';
import { useVaultCollection } from '@/features/vault/use-vault-collection';

export default function VaultScreen() {
  const router = useRouter();
  const vault = useVaultCollection();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => vault.captures.some((capture) => capture.id === id))));
  }, [vault.captures]);

  const selected = useMemo(() => [...selectedIds], [selectedIds]);
  const toggleSelecting = () => {
    setSelecting((value) => !value);
    setSelectedIds(new Set());
    setNotice(null);
  };
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const finishSelection = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };
  const share = async () => {
    if (!selected.length) return setNotice('Choose at least one idea to share.');
    setPending(true); setNotice(null);
    try {
      await vault.actions.share(selected);
    } catch {
      setNotice('Could not open sharing for the selected ideas.');
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    if (!selected.length) return;
    setPending(true); setNotice(null);
    try {
      const selectedCaptures = vault.captures.filter((capture) => selectedIds.has(capture.id));
      const receipts = await vault.actions.remove(selectedCaptures);
      const delayed = receipts.flatMap((receipt) => receipt.pendingAudioUris).length;
      finishSelection();
      setNotice(delayed ? 'Ideas were deleted. Some retained audio will be cleaned up when storage is available.' : 'Ideas deleted from this device.');
    } catch {
      setNotice('Could not delete every selected idea. Please try again.');
    } finally {
      setPending(false);
    }
  };
  const hasFilters = Boolean(vault.query.trim() || vault.filters.starredOnly || vault.filters.statuses.length || vault.filters.sort !== 'newest');

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <VaultHeader count={vault.captures.length} onToggleSelecting={toggleSelecting} selecting={selecting} />
      <VaultToolbar filters={vault.filters} onFiltersChange={vault.setFilters} onQueryChange={vault.setQuery} query={vault.query} />
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      {selecting ? <VaultBulkActions count={selected.length} onCancel={finishSelection} onDelete={remove} onShare={share} pending={pending} /> : null}
      {vault.loading ? <VaultCollectionState kind="loading" /> : null}
      {!vault.loading && vault.error ? <VaultCollectionState kind="error" onRetry={vault.actions.refresh} /> : null}
      {!vault.loading && !vault.error && !vault.captures.length ? <VaultCollectionState kind={hasFilters ? 'no-results' : 'empty'} onRetry={vault.actions.refresh} onStartCapture={() => router.push('/')} /> : null}
      {!vault.loading && !vault.error && vault.captures.length ? <IdeaVaultList
        captures={vault.captures}
        onOpen={(id) => router.push(`/vault/${id}`)}
        onToggleSelected={toggleSelected}
        onToggleStar={(capture) => void vault.actions.toggleStar(capture).catch(() => setNotice('Could not update the star.'))}
        selectedIds={selectedIds}
        selecting={selecting}
      /> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 112 },
  notice: { marginTop: 16, color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12, lineHeight: 18 },
});
