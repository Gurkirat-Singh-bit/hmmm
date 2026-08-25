/**
 * @file [ideaId].tsx
 * @description Idea-bound discussion route with a recoverable unknown-idea state.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useLocalSearchParams, useRouter } from 'expo-router';

import { IdeaDiscussion } from '@/components/discuss/IdeaDiscussion';
import { DiscussionNotFound } from '@/components/discuss/DiscussionNotFound';
import { getDiscussionThread } from '@/features/discussion/discussion-preview';
import { previewIdeaReports, previewVaultIdeas } from '@/features/vault/vault-preview';

export default function IdeaDiscussionRoute() {
  const { ideaId } = useLocalSearchParams<{ ideaId?: string | string[] }>();
  const router = useRouter();
  const resolvedId = Array.isArray(ideaId) ? ideaId[0] : ideaId;
  const idea = previewVaultIdeas.find((item) => item.id === resolvedId);
  const report = resolvedId ? previewIdeaReports[resolvedId] : undefined;

  if (!idea || !report) {
    return <DiscussionNotFound onBack={() => router.replace('/discuss')} onVault={() => router.replace('/vault')} />;
  }

  return <IdeaDiscussion idea={idea} report={report} thread={getDiscussionThread(idea.id)} />;
}
