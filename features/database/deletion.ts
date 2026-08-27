import type {
  AudioFilePort,
  DataDeletionPort,
  DeletionReceipt,
  DeletionRequest,
  SecretStorePort,
} from '../domain/contracts';
import { domainError, normalizeError } from '../domain/errors';
import type { SqliteCleanupQueueRepository, SqliteDeletionRepository } from './repositories';

export type DataDeletionDependencies = Readonly<{
  deletions: SqliteDeletionRepository;
  cleanup: SqliteCleanupQueueRepository;
  secrets: SecretStorePort;
  audioFiles: AudioFilePort;
  isAppOwnedUri: (uri: string) => boolean;
  now?: () => Date;
}>;

export class LocalDataDeletion implements DataDeletionPort {
  private readonly now: () => Date;

  constructor(private readonly dependencies: DataDeletionDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(request: DeletionRequest) {
    const orphanUris = await this.globalOrphanUris(request.target);
    const staged = orphanUris.length
      ? await this.dependencies.deletions.stage(request, orphanUris)
      : await this.dependencies.deletions.stage(request);
    if (request.target.kind === 'full-reset') await this.clearSecrets(request.operationId);
    await this.drainCleanup();
    return (await this.dependencies.deletions.receipt(staged.operationId))!;
  }

  async retry(operationId: string): Promise<DeletionReceipt> {
    const tombstone = await this.dependencies.deletions.getTombstone(operationId);
    if (!tombstone) throw domainError('not-found', 'database', 'The deletion operation was not found.');
    await this.dependencies.cleanup.requeueFailed(operationId, this.now().toISOString());
    if (tombstone.target.kind === 'full-reset') await this.clearSecrets(operationId);
    await this.drainCleanup();
    return (await this.dependencies.deletions.receipt(operationId))!;
  }

  /** Resumes file cleanup left running when Android stopped the process. */
  async resume() {
    await this.dependencies.cleanup.requeueRunning(this.now().toISOString());
    await this.drainCleanup();
  }

  private async clearSecrets(operationId: string) {
    const now = this.now().toISOString();
    try {
      await this.dependencies.secrets.clear();
      await this.dependencies.deletions.setSecureData(operationId, 'deleted', now);
    } catch {
      await this.dependencies.deletions.setSecureData(operationId, 'failed', now);
    }
  }

  private async globalOrphanUris(target: DeletionRequest['target']) {
    if (target.kind === 'capture') return [];
    const uris = await this.dependencies.audioFiles.listAppOwnedAudioUris();
    return [...new Set(uris)].filter((uri): uri is string =>
      typeof uri === 'string' && this.dependencies.isAppOwnedUri(uri));
  }

  private async drainCleanup() {
    while (true) {
      const now = this.now();
      const item = await this.dependencies.cleanup.claimNext(now.toISOString());
      if (!item) return;
      if (!this.dependencies.isAppOwnedUri(item.uri)) {
        await this.dependencies.cleanup.fail(item.id, domainError(
          'invalid-url',
          'file-cleanup',
          'A retained audio path is outside app-owned storage.',
          false,
          now.toISOString(),
        ).detail);
        continue;
      }
      try {
        if (await this.dependencies.audioFiles.exists(item.uri)) await this.dependencies.audioFiles.delete(item.uri);
        await this.dependencies.cleanup.complete(item.id);
      } catch (error) {
        const normalized = normalizeError(error, 'file-cleanup', now.toISOString());
        const delayMs = Math.min(60_000, 1_000 * 2 ** Math.max(0, item.attempts - 1));
        await this.dependencies.cleanup.retry(item.id, new Date(now.getTime() + delayMs).toISOString(), normalized);
      }
    }
  }
}
