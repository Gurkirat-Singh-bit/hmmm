/**
 * @file vault.tsx
 * @description Searchable Vault route for validated and stored ideas.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IdeaVaultList } from '@/components/vault/IdeaVaultList';
import { VaultHeader } from '@/components/vault/VaultHeader';
import { VaultToolbar } from '@/components/vault/VaultToolbar';
import { colors, spacing } from '@/constants/theme';
import { previewVaultIdeas, type VaultFilter, type VaultStatusFilter } from '@/features/vault/vault-preview';

export default function VaultScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VaultFilter>('latest');
  const [status, setStatus] = useState<VaultStatusFilter>('all');
  const [starredIds, setStarredIds] = useState(() => new Set(previewVaultIdeas.filter((idea) => idea.starred).map((idea) => idea.id)));
  const ideas = useMemo(() => previewVaultIdeas.map((idea) => ({ ...idea, starred: starredIds.has(idea.id) })).filter((idea) => {
    const matchesQuery = `${idea.title} ${idea.summary}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter !== 'starred' || idea.starred;
    const matchesStatus = status === 'all' || idea.status === status;
    return matchesQuery && matchesFilter && matchesStatus;
  }).sort((a, b) => Number(b.status === 'processing') - Number(a.status === 'processing')), [filter, query, starredIds, status]);

  const toggleStar = (id: string) => setStarredIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <SafeAreaView edges={['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><VaultHeader /><VaultToolbar filter={filter} onFilterChange={setFilter} onQueryChange={setQuery} onStatusChange={setStatus} query={query} status={status} /><IdeaVaultList ideas={ideas} onOpen={(id) => router.push(`/vault/${id}`)} onToggleStar={toggleStar} /></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 14, paddingBottom: 112 } });
