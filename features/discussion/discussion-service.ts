import type { AppDatabase } from '@/features/database/database';
import type {
  AppPreferencesRecord,
  CaptureId,
  CaptureRecord,
  DataGeneration,
  DiscussionDraftRecord,
  MessageRecord,
  NormalizedError,
  ReportRecord,
  ReportUpdateProposal,
} from '@/features/domain/contracts';
import { DomainError, domainError, normalizeError } from '@/features/domain/errors';
import type { DiscussionRequest, ProviderContext } from '@/features/domain/providers';
import { providerCredentials, readPreferences } from '@/features/onboarding/storage';
import { PROVIDER_CONTEXT_LIMITS } from '@/features/providers/config';
import { providerRegistry } from '@/features/providers/registry';
import { applyDiscussionReportUpdate } from '@/features/vault/vault-service';
import { getVaultDatabase } from '@/features/vault/vault-runtime';

const MESSAGE_PAGE_SIZE = 500;
const REQUEST_CONTEXT_MESSAGES = 20;

export type DiscussionAvailability = 'ready' | 'offline' | 'missing-provider';

export type DiscussionThreadData = Readonly<{
  capture: CaptureRecord;
  report: ReportRecord | null;
  messages: readonly MessageRecord[];
  draft: DiscussionDraftRecord | null;
  availability: DiscussionAvailability;
}>;

export type DiscussionThreadSummary = Readonly<{
  captureId: CaptureId;
  title: string;
  preview: string;
  updatedAt: string;
}>;

type ActiveStream = Readonly<{
  assistantId: string;
  generation: DataGeneration;
  controller: AbortController;
  database: AppDatabase;
}>;

class DiscussionService {
  private readonly activeStreams = new Map<CaptureId, ActiveStream>();
  private readonly pendingTurns = new Set<CaptureId>();

  async loadHome() {
    const database = await getVaultDatabase();
    const captures = await database.repositories.captures.list({
      search: '', starred: null, statuses: [], sort: 'newest', limit: null, offset: 0,
    });
    await Promise.all(captures.map((capture) => this.reconcileInterrupted(database, capture.id, capture.generation)));
    const threadEntries = await Promise.all(captures.map(async (capture) => {
      const messages = await database.repositories.messages.list(capture.id, 1, null);
      if (!messages.length) return null;
      const lastMessage = messages.at(-1)!;
      return {
        captureId: capture.id,
        title: capture.title?.trim() || 'Untitled idea',
        preview: lastMessage.content.trim() || (lastMessage.role === 'assistant' ? 'Thinking through your idea…' : 'New message'),
        updatedAt: lastMessage.updatedAt,
      } satisfies DiscussionThreadSummary;
    }));
    return {
      captures: captures.filter((capture) => capture.status === 'ready'),
      threads: threadEntries.filter((thread): thread is DiscussionThreadSummary => thread !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
  }

  async loadThread(captureId: string): Promise<DiscussionThreadData | null> {
    const database = await getVaultDatabase();
    const capture = await database.repositories.captures.get(captureId);
    if (!capture) {
      await this.abort(captureId, 'This reply stopped because the idea was deleted.');
      return null;
    }
    await this.reconcileInterrupted(database, captureId, capture.generation);
    const current = await database.repositories.captures.get(captureId);
    if (!current || current.generation !== capture.generation) {
      await this.abort(captureId, 'This reply stopped because the idea was deleted or replaced.');
      return null;
    }
    const [report, messages, draft, preferences] = await Promise.all([
      database.repositories.reports.getActive(captureId),
      database.repositories.messages.list(captureId, MESSAGE_PAGE_SIZE, null),
      database.repositories.discussionDrafts.get(captureId),
      readPreferences(),
    ]);
    const latest = await database.repositories.captures.get(captureId);
    if (!latest || latest.generation !== capture.generation) {
      await this.abort(captureId, 'This reply stopped because the idea was deleted or replaced.');
      return null;
    }
    return { capture: latest, report, messages, draft, availability: discussionAvailability(preferences) };
  }

  async saveDraft(captureId: CaptureId, expectedGeneration: DataGeneration, content: string) {
    const database = await getVaultDatabase();
    await this.captureForGeneration(database, captureId, expectedGeneration);
    try {
      if (!content.trim()) {
        await database.repositories.discussionDrafts.delete(captureId, expectedGeneration);
        return;
      }
      await database.repositories.discussionDrafts.save({ captureId, generation: expectedGeneration, content, updatedAt: new Date().toISOString() });
    } catch (error) {
      await this.throwIfDeleted(database, captureId, expectedGeneration, error);
    }
  }

  async send(captureId: CaptureId, expectedGeneration: DataGeneration, content: string) {
    const message = content.trim();
    if (!message) return;
    const database = await getVaultDatabase();
    await this.captureForGeneration(database, captureId, expectedGeneration);
    if (this.activeStreams.has(captureId) || this.pendingTurns.has(captureId)) {
      throw domainError('conflict', 'discussion', 'Wait for the current reply before sending another message.');
    }
    this.pendingTurns.add(captureId);
    try {
      const preferences = await readPreferences();
      const availability = discussionAvailability(preferences);
      if (availability === 'offline') throw domainError('offline', 'discussion', 'You are offline. Your draft is saved locally.', true);
      if (availability !== 'ready') {
        throw domainError('configuration-missing', 'discussion', 'Add a working AI provider before sending a message.', true);
      }
      const requestId = identity('discussion');
      const now = new Date().toISOString();
      const { assistant } = await database.repositories.messages.appendUserAndStartAssistant({
        id: identity('message'),
        assistantId: identity('message'),
        captureId,
        expectedGeneration,
        clientRequestId: requestId,
        content: message,
        createdAt: now,
      });
      await database.repositories.discussionDrafts.delete(captureId, expectedGeneration);
      this.startStream(database, captureId, assistant);
    } catch (error) {
      await this.throwIfDeleted(database, captureId, expectedGeneration, error);
    } finally {
      this.pendingTurns.delete(captureId);
    }
  }

  async retry(captureId: CaptureId, expectedGeneration: DataGeneration, assistantId: string, mode: 'restart' | 'resume') {
    const database = await getVaultDatabase();
    await this.captureForGeneration(database, captureId, expectedGeneration);
    if (this.activeStreams.has(captureId) || this.pendingTurns.has(captureId)) {
      throw domainError('conflict', 'discussion', 'Wait for the current reply before trying again.');
    }
    this.pendingTurns.add(captureId);
    try {
      const preferences = await readPreferences();
      const availability = discussionAvailability(preferences);
      if (availability === 'offline') throw domainError('offline', 'discussion', 'You are offline. Reconnect before retrying.', true);
      if (availability !== 'ready') {
        throw domainError('configuration-missing', 'discussion', 'Add a working AI provider before retrying.', true);
      }
      const existing = (await database.repositories.messages.list(captureId, MESSAGE_PAGE_SIZE, null))
        .find((message) => message.id === assistantId && message.role === 'assistant' && message.generation === expectedGeneration);
      if (!existing) throw domainError('not-found', 'discussion', 'This saved reply is no longer available.');
      const assistant = await database.repositories.messages.retryAssistant(assistantId, expectedGeneration, mode, new Date().toISOString());
      this.startStream(database, captureId, assistant);
    } catch (error) {
      await this.throwIfDeleted(database, captureId, expectedGeneration, error);
    } finally {
      this.pendingTurns.delete(captureId);
    }
  }

  async applyProposal(proposal: ReportUpdateProposal, expectedGeneration: DataGeneration) {
    const database = await getVaultDatabase();
    await this.captureForGeneration(database, proposal.captureId, expectedGeneration);
    try {
      const activeReport = await database.repositories.reports.getActive(proposal.captureId);
      if (!activeReport || activeReport.generation !== expectedGeneration || activeReport.revision !== proposal.baseRevision) {
        throw domainError('conflict', 'discussion', 'This proposal is based on an older report. Review the latest report before applying it.');
      }
      const sources = await database.repositories.reports.listSources(proposal.captureId, activeReport.revision);
      return applyDiscussionReportUpdate(proposal, activeReport, sources, expectedGeneration);
    } catch (error) {
      await this.throwIfDeleted(database, proposal.captureId, expectedGeneration, error);
    }
  }

  async abort(captureId: CaptureId, message: string) {
    const active = this.activeStreams.get(captureId);
    if (!active) return;
    active.controller.abort();
    this.activeStreams.delete(captureId);
    await active.database.repositories.messages.interruptAssistant(
      active.assistantId,
      active.generation,
      cancellationError(message),
      new Date().toISOString(),
    ).catch(() => undefined);
  }

  private startStream(database: AppDatabase, captureId: CaptureId, assistant: MessageRecord) {
    const active: ActiveStream = { assistantId: assistant.id, generation: assistant.generation, controller: new AbortController(), database };
    this.activeStreams.set(captureId, active);
    void this.stream(captureId, assistant, active);
  }

  private async stream(
    captureId: CaptureId,
    assistant: MessageRecord,
    active: ActiveStream,
  ) {
    try {
      const [request, preferences] = await Promise.all([
        this.requestFor(active.database, captureId, assistant),
        readPreferences(),
      ]);
      const provider = providerRegistry.getAi(preferences.aiProvider.providerId);
      if (!provider) {
        throw domainError('configuration-missing', 'discussion', 'The selected AI provider does not support discussion.', true);
      }
      let completed = false;
      if (!provider.descriptor.capabilities['ai.discussion-streaming'] || !provider.streamDiscussion) {
        if (!provider.completeDiscussion) {
          throw domainError('configuration-missing', 'discussion', 'The selected AI provider does not support discussion.', true);
        }
        const credential = await providerCredentials.readActive('ai');
        const context: ProviderContext = {
          selection: preferences.aiProvider,
          apiKey: credential?.secret ?? null,
        };
        const response = await provider.completeDiscussion(context, request);
        if (active.controller.signal.aborted) throw domainError('cancelled', 'discussion', 'This reply was stopped.', true);
        await active.database.repositories.messages.appendAssistantDelta(
          assistant.id,
          active.generation,
          assistant.lastSequence + 1,
          response.content,
          new Date().toISOString(),
        );
        await active.database.repositories.messages.finishAssistant(assistant.id, active.generation, response.reportUpdateProposal, response.completedAt);
        completed = true;
      } else {
        const credential = await providerCredentials.readActive('ai');
        const context: ProviderContext = {
          selection: preferences.aiProvider,
          apiKey: credential?.secret ?? null,
        };
        for await (const event of provider.streamDiscussion(context, request)) {
          if (active.controller.signal.aborted) throw domainError('cancelled', 'discussion', 'This reply was stopped.', true);
          if (event.type === 'delta') {
            await active.database.repositories.messages.appendAssistantDelta(
              assistant.id,
              active.generation,
              assistant.lastSequence + event.sequence,
              event.content,
              new Date().toISOString(),
            );
          } else {
            await active.database.repositories.messages.finishAssistant(assistant.id, active.generation, event.reportUpdateProposal, event.completedAt);
            completed = true;
          }
        }
      }
      if (!completed) throw domainError('invalid-provider-output', 'discussion', 'The provider ended before completing the reply.', true);
    } catch (error) {
      if (await this.captureWasDeleted(active.database, captureId, active.generation)) {
        active.controller.abort();
        if (this.activeStreams.get(captureId) === active) this.activeStreams.delete(captureId);
      } else if (!active.controller.signal.aborted) {
        await active.database.repositories.messages.interruptAssistant(
          assistant.id,
          active.generation,
          normalizeError(error, 'discussion'),
          new Date().toISOString(),
        ).catch(() => undefined);
      }
    } finally {
      if (this.activeStreams.get(captureId) === active) this.activeStreams.delete(captureId);
    }
  }

  private async requestFor(database: AppDatabase, captureId: CaptureId, assistant: MessageRecord): Promise<DiscussionRequest> {
    const [capture, messages, preferences] = await Promise.all([
      database.repositories.captures.get(captureId),
      database.repositories.messages.list(captureId, MESSAGE_PAGE_SIZE, null),
      database.repositories.preferences.get(),
    ]);
    if (!capture || capture.generation !== assistant.generation) throw deletedCaptureError();
    const user = messages.find((message) => message.id === assistant.replyToMessageId
      && message.role === 'user' && message.generation === assistant.generation);
    if (!user) throw domainError('not-found', 'discussion', 'The message being answered is no longer available.');
    const report = user.reportRevision === null ? null : await database.repositories.reports.get(captureId, user.reportRevision);
    if (report && report.generation !== assistant.generation) throw deletedCaptureError();
    return {
      requestId: assistant.clientRequestId,
      captureId,
      replyToMessageId: user.id,
      transcript: capture.transcript?.text.slice(0, PROVIDER_CONTEXT_LIMITS.discussionTranscriptCharacters) ?? '',
      report: report?.content ?? null,
      reportRevision: report?.revision ?? null,
      messages: messages
        .filter((message) => message.id !== assistant.id && message.generation === assistant.generation && message.content.trim())
        .slice(-REQUEST_CONTEXT_MESSAGES)
        .map(({ id, role, content }) => ({ id, role, content }))
        .concat(partialAssistantContext(assistant)),
      languageTag: preferences.languageTag,
      systemPrompt: preferences.customSystemPrompt,
    };
  }

  private async reconcileInterrupted(database: AppDatabase, captureId: CaptureId, expectedGeneration: DataGeneration) {
    if (this.activeStreams.has(captureId) || this.pendingTurns.has(captureId)) return;
    const capture = await database.repositories.captures.get(captureId);
    if (!capture || capture.generation !== expectedGeneration) return;
    const messages = await database.repositories.messages.list(captureId, MESSAGE_PAGE_SIZE, null);
    const repliedUserIds = new Set(messages
      .filter((message) => message.role === 'assistant' && message.generation === expectedGeneration && message.replyToMessageId)
      .map((message) => message.replyToMessageId));
    await Promise.all(messages
      .filter((message) => message.role === 'user' && message.generation === expectedGeneration && !repliedUserIds.has(message.id))
      .map(async (message) => {
        try {
          const assistant = await database.repositories.messages.startAssistant({
            id: identity('message'),
            captureId,
            expectedGeneration,
            clientRequestId: message.clientRequestId,
            replyToMessageId: message.id,
            createdAt: message.createdAt,
          });
          await database.repositories.messages.interruptAssistant(
            assistant.id,
            expectedGeneration,
            cancellationError('This reply was interrupted before the app could finish it.'),
            new Date().toISOString(),
          );
        } catch (error) {
          if (!isStaleGeneration(error)) throw error;
        }
      }));
    await Promise.all(messages
      .filter((message) => message.role === 'assistant' && message.generation === expectedGeneration
        && (message.status === 'queued' || message.status === 'streaming'))
      .map(async (message) => {
        try {
          await database.repositories.messages.interruptAssistant(
            message.id,
            expectedGeneration,
            cancellationError('This reply was interrupted before the app could finish it.'),
            new Date().toISOString(),
          );
        } catch (error) {
          if (!isStaleGeneration(error)) throw error;
        }
      }));
  }

  private async captureForGeneration(database: AppDatabase, captureId: CaptureId, expectedGeneration: DataGeneration) {
    const capture = await database.repositories.captures.get(captureId);
    if (!capture || capture.generation !== expectedGeneration) {
      await this.abort(captureId, 'This reply stopped because the idea was deleted.');
      throw deletedCaptureError();
    }
    return capture;
  }

  private async throwIfDeleted(
    database: AppDatabase,
    captureId: CaptureId,
    expectedGeneration: DataGeneration,
    error: unknown,
  ): Promise<never> {
    if (await this.captureWasDeleted(database, captureId, expectedGeneration)) {
      await this.abort(captureId, 'This reply stopped because the idea was deleted.');
      throw deletedCaptureError();
    }
    throw error;
  }

  private async captureWasDeleted(database: AppDatabase, captureId: CaptureId, expectedGeneration: DataGeneration) {
    const capture = await database.repositories.captures.get(captureId).catch(() => null);
    return !capture || capture.generation !== expectedGeneration;
  }
}

function partialAssistantContext(assistant: MessageRecord) {
  if (!assistant.content.trim()) return [] as const;
  return [
    {
      id: `${assistant.id}:partial`,
      role: 'assistant' as const,
      content: assistant.content.slice(0, PROVIDER_CONTEXT_LIMITS.discussionMessageCharacters),
    },
    {
      id: `${assistant.id}:continue`,
      role: 'user' as const,
      content: 'Continue the saved partial reply from this point. Return only new continuation text and do not repeat the saved partial reply.',
    },
  ] as const;
}

function isStaleGeneration(error: unknown) {
  return error instanceof DomainError && (error.detail.code === 'cancelled' || error.detail.code === 'not-found');
}

function deletedCaptureError() {
  return domainError('not-found', 'discussion', 'This idea is no longer available.');
}

function discussionAvailability(preferences: AppPreferencesRecord): DiscussionAvailability {
  if (!isNetworkAvailable()) return 'offline';
  const provider = providerRegistry.getAi(preferences.aiProvider.providerId);
  return provider?.descriptor.capabilities['ai.discussion'] && preferences.aiProvider.model.trim() ? 'ready' : 'missing-provider';
}

function isNetworkAvailable() {
  const environment = globalThis as typeof globalThis & { navigator?: { onLine?: boolean } };
  return environment.navigator?.onLine !== false;
}

function cancellationError(message: string): NormalizedError {
  return domainError('cancelled', 'discussion', message, true).detail;
}

function identity(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

export const discussionService = new DiscussionService();
