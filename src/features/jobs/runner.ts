/**
 * @file runner.ts
 * @description Leases, retries, and completes durable jobs while the app is active.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  LocalSubscriptionPort,
  NormalizedError,
} from "../domain/contracts";
import { domainError, normalizeError } from "../domain/errors";
import type {
  JobHandler,
  JobKind,
  JobRecord,
  JobRepository,
  JobRunnerPort,
} from "./contracts";
import { JOB_RUNTIME } from "./config";

export type ForegroundJobRunnerOptions = Readonly<{
  repository: JobRepository;
  handlers: readonly JobHandler[];
  subscriptions?: LocalSubscriptionPort;
  leaseMs?: number;
  idlePollMs?: number;
  now?: () => Date;
  onTerminalFailure?: (job: JobRecord, error: NormalizedError) => Promise<void>;
}>;
export class ForegroundJobRunner implements JobRunnerPort {
  private readonly handlers: ReadonlyMap<JobKind, JobHandler>;
  private readonly leaseMs: number;
  private readonly idlePollMs: number;
  private readonly now: () => Date;
  private active = false;
  private draining: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  constructor(private readonly options: ForegroundJobRunnerOptions) {
    this.handlers = new Map(
      options.handlers.map((handler) => [handler.kind, handler] as const),
    );
    this.leaseMs = options.leaseMs ?? JOB_RUNTIME.leaseMs;
    this.idlePollMs = options.idlePollMs ?? JOB_RUNTIME.idlePollMs;
    this.now = options.now ?? (() => new Date());
  }
  start() {
    if (this.active) return;
    this.active = true;
    this.unsubscribe =
      this.options.subscriptions?.subscribe((change) => {
        if (change.table === "jobs") this.wake();
      }) ?? null;
    this.begin(this.recoverAndDrain());
  }
  wake() {
    if (!this.active || this.draining) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.begin(this.drain());
  }
  async stop() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.draining;
  }
  private async recoverAndDrain() {
    const expired = await this.options.repository.requeueExpiredLeases(
      this.now().toISOString(),
    );
    for (const job of expired) {
      if (job.lastError)
        await this.options.onTerminalFailure?.(job, job.lastError);
    }
    await this.drain();
  }
  private begin(task: Promise<void>) {
    this.draining = task
      .catch(() => {
        if (this.active)
          this.timer = setTimeout(() => this.wake(), this.idlePollMs);
      })
      .finally(() => {
        this.draining = null;
      });
  }
  private async drain() {
    while (this.active) {
      const now = this.now();
      const job = await this.options.repository.claimNext(
        now.toISOString(),
        new Date(now.getTime() + this.leaseMs).toISOString(),
      );
      if (!job) break;
      const handler = this.handlers.get(job.kind);
      if (!handler) {
        const error = domainError(
          "unsupported",
          "database",
          `No handler is registered for ${job.kind}.`,
        ).detail;
        await this.options.repository.fail(
          job.id,
          job.generation,
          this.now().toISOString(),
          error,
        );
        await this.options.onTerminalFailure?.(job, error);
        continue;
      }
      try {
        await handler.run(job);
        await this.options.repository.succeed(
          job.id,
          job.generation,
          this.now().toISOString(),
        );
      } catch (cause) {
        const error = normalizeError(
          cause,
          job.kind === "transcribe-capture"
            ? "transcription"
            : "report-generation",
        );
        if (error.retryable && job.attempts < job.maxAttempts) {
          const delayMs = Math.min(
            JOB_RUNTIME.retryMaxDelayMs,
            JOB_RUNTIME.retryBaseDelayMs * 2 ** Math.max(0, job.attempts - 1),
          );
          await this.options.repository.retry(
            job.id,
            job.generation,
            new Date(this.now().getTime() + delayMs).toISOString(),
            error,
          );
        } else {
          await this.options.repository.fail(
            job.id,
            job.generation,
            this.now().toISOString(),
            error,
          );
          await this.options.onTerminalFailure?.(job, error);
        }
      }
    }
    if (this.active)
      this.timer = setTimeout(() => this.wake(), this.idlePollMs);
  }
}
