/**
 * @file [ideaId].tsx
 * @description Idea-bound discussion route with a recoverable unknown-idea state.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useLocalSearchParams, useRouter } from "expo-router";

import { IdeaDiscussion } from "@/components/discuss/IdeaDiscussion";
import { DiscussionNotFound } from "@/components/discuss/DiscussionNotFound";
import { useDiscussionThread } from "@/features/discussion/use-discussion";
export default function IdeaDiscussionRoute() {
  const { ideaId } = useLocalSearchParams<{ ideaId?: string | string[] }>();
  const router = useRouter();
  const resolvedId = Array.isArray(ideaId) ? ideaId[0] : ideaId;
  const thread = useDiscussionThread(resolvedId);

  if (!resolvedId) {
    return (
      <DiscussionNotFound
        onBack={() => router.replace("/discuss")}
        onVault={() => router.replace("/vault")}
      />
    );
  }
  if (thread.loading)
    return (
      <DiscussionNotFound
        kind="loading"
        onBack={() => router.replace("/discuss")}
        onVault={() => router.replace("/vault")}
      />
    );
  if (thread.error)
    return (
      <DiscussionNotFound
        kind="error"
        onBack={() => router.replace("/discuss")}
        onRetry={thread.refresh}
        onVault={() => router.replace("/vault")}
      />
    );
  if (!thread.data)
    return (
      <DiscussionNotFound
        onBack={() => router.replace("/discuss")}
        onVault={() => router.replace("/vault")}
      />
    );

  return (
    <IdeaDiscussion
      applyProposal={thread.applyProposal}
      composer={thread.composer}
      data={thread.data}
      notice={thread.notice?.message ?? null}
      onRetry={(assistantId, mode) => void thread.retry(assistantId, mode)}
      onSend={() => void thread.send()}
      onSetComposer={thread.setComposer}
      sending={thread.sending}
    />
  );
}
