/**
 * @file handlers.ts
 * @description Executes transcription and report jobs against providers and local repositories.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  AppPreferencesRecord,
  CaptureRecord,
  NotificationPort,
  NormalizedError,
  ReportField,
  ReportProvenance,
  SecretStorePort,
} from "../domain/contracts";
import { domainError } from "../domain/errors";
import type {
  ProviderContext,
  ProviderRegistryPort,
  ResearchResult,
} from "../domain/providers";
import type { AppRepositories } from "../storage/contracts";
import type {
  JobHandler,
  JobRecord,
  ReportJobPayload,
  TranscriptionJobPayload,
} from "./contracts";
import { reportJob } from "./triggers";

export type ProcessingHandlerDependencies = Readonly<{
  repositories: AppRepositories;
  providers: ProviderRegistryPort;
  secrets: SecretStorePort;
  notifications?: NotificationPort;
  now?: () => Date;
  maxReportAttempts?: number;
}>;

const reportFields = [
  "gist",
  "evidence",
  "risks",
  "nextMove",
  "verdict",
] as const satisfies readonly ReportField[];
function requireProviderSelection(
  preferences: AppPreferencesRecord,
  kind: "speech" | "ai",
) {
  const selection =
    kind === "speech" ? preferences.speechProvider : preferences.aiProvider;
  if (!selection.providerId || !selection.model) {
    throw domainError(
      "configuration-missing",
      "provider-configuration",
      `Configure an ${kind} provider first.`,
    );
  }
  return selection;
}
async function providerContext(
  dependencies: ProcessingHandlerDependencies,
  preferences: AppPreferencesRecord,
  kind: "speech" | "ai",
): Promise<ProviderContext> {
  return {
    selection: requireProviderSelection(preferences, kind),
    apiKey: (await dependencies.secrets.readActive(kind))?.secret ?? null,
  };
}
function providerProvenance(
  now: string,
  sourceRevision: number | null,
): ReportProvenance {
  const field = {
    owner: "provider" as const,
    origin: "ai-generated" as const,
    sourceRevision,
    changedAt: now,
  };
  return Object.fromEntries(
    reportFields.map((name) => [name, field]),
  ) as ReportProvenance;
}
export function createTranscriptionHandler(
  dependencies: ProcessingHandlerDependencies,
): JobHandler<TranscriptionJobPayload> {
  const now = dependencies.now ?? (() => new Date());
  return {
    kind: "transcribe-capture",
    async run(rawJob) {
      const job = rawJob as JobRecord &
        Readonly<{
          kind: "transcribe-capture";
          payload: TranscriptionJobPayload;
        }>;
      const capture = await dependencies.repositories.captures.get(
        job.captureId,
      );
      if (!capture)
        throw domainError(
          "not-found",
          "transcription",
          "The capture was deleted.",
        );
      if (capture.generation !== job.generation)
        throw domainError(
          "cancelled",
          "transcription",
          "The capture was deleted.",
        );
      const preferences = await dependencies.repositories.preferences.get();
      const context = await providerContext(
        dependencies,
        preferences,
        "speech",
      );
      const provider = dependencies.providers.getSpeech(
        context.selection.providerId,
      );
      if (
        !provider?.descriptor.capabilities["speech.file-transcription"] ||
        !provider.transcribe
      ) {
        throw domainError(
          "unsupported",
          "transcription",
          "This speech provider cannot transcribe saved audio.",
        );
      }
      await dependencies.repositories.captures.setProcessingState(
        job.captureId,
        "transcribing",
        null,
        now().toISOString(),
        job.generation,
      );
      const output = await provider.transcribe(context, {
        requestId: job.requestId,
        audio: job.payload.audio,
        languageTag: preferences.languageTag,
      });
      const completedAt = now().toISOString();
      const transcriptRevision = job.payload.expectedTranscriptRevision + 1;
      const provisional =
        await dependencies.repositories.reports.getLatestProvisional(
          job.captureId,
        );
      await dependencies.repositories.captures.completeTranscription({
        id: job.captureId,
        expectedRevision: job.payload.expectedTranscriptRevision,
        expectedGeneration: job.generation,
        transcript: {
          requestId: job.requestId,
          phase: "final",
          revision: transcriptRevision,
          text: output.text,
          languageTag: output.languageTag,
          segments: output.segments,
          providerId: provider.descriptor.id,
          createdAt: completedAt,
        },
        reportJob:
          provisional?.transcriptRevision ===
          job.payload.expectedTranscriptRevision
            ? undefined
            : reportJob({
                captureId: job.captureId,
                generation: job.generation,
                revision: job.revision,
                requestId: `${job.requestId}:report`,
                transcriptRevision,
                expectedActiveRevision: null,
                researchEnabled: preferences.researchEnabled,
                reason: "initial-capture",
                explicitlyReplacedUserFields: [],
                runAfter: completedAt,
                maxAttempts: dependencies.maxReportAttempts ?? 3,
              }),
        updatedAt: completedAt,
      });
    },
  };
}
export function createReportHandler(
  dependencies: ProcessingHandlerDependencies,
): JobHandler<ReportJobPayload> {
  const now = dependencies.now ?? (() => new Date());
  return {
    kind: "generate-report",
    async run(rawJob) {
      const job = rawJob as JobRecord &
        Readonly<{ kind: "generate-report"; payload: ReportJobPayload }>;
      const capture = await dependencies.repositories.captures.get(
        job.captureId,
      );
      requireMatchingTranscript(capture, job.payload.transcriptRevision);
      if (capture.generation !== job.generation)
        throw domainError(
          "cancelled",
          "report-generation",
          "The capture was deleted.",
        );
      const active = await dependencies.repositories.reports.getActive(
        job.captureId,
      );
      if ((active?.revision ?? null) !== job.payload.expectedActiveRevision) {
        throw domainError(
          "conflict",
          "report-generation",
          "The report changed after this regeneration was confirmed.",
        );
      }
      const isProvisional = capture.transcript.phase === "provisional";
      const preferences = await dependencies.repositories.preferences.get();
      const context = await providerContext(dependencies, preferences, "ai");
      const provider = dependencies.providers.getAi(
        context.selection.providerId,
      );
      if (
        !provider?.descriptor.capabilities["ai.report-generation"] ||
        !provider.generateReport
      ) {
        throw domainError(
          "unsupported",
          "report-generation",
          "This AI provider cannot generate reports.",
        );
      }
      const researchAllowed =
        job.payload.researchEnabled &&
        preferences.researchEnabled &&
        preferences.researchConsent.status === "granted";
      let research: ResearchResult | null = null;
      if (researchAllowed) {
        if (
          !provider.descriptor.capabilities["ai.research-with-citations"] ||
          !provider.research
        ) {
          throw domainError(
            "unsupported",
            "research",
            "This AI provider cannot perform cited research.",
          );
        }
        if (!isProvisional) {
          await dependencies.repositories.captures.setProcessingState(
            job.captureId,
            "researching",
            null,
            now().toISOString(),
            job.generation,
          );
        }
        try {
          research = await provider.research(context, {
            requestId: `${job.requestId}:research`,
            captureId: job.captureId,
            transcript: capture!.transcript!.text,
            languageTag: preferences.languageTag,
          });
        } catch (error) {
          if (provider.descriptor.id !== "openrouter") throw error;
          research = null;
        }
      } else if (!isProvisional) {
        await dependencies.repositories.captures.setProcessingState(
          job.captureId,
          "naming",
          null,
          now().toISOString(),
          job.generation,
        );
      }
      const generated = await provider.generateReport(context, {
        requestId: job.requestId,
        captureId: job.captureId,
        transcript: capture!.transcript!.text,
        transcriptRevision: job.payload.transcriptRevision,
        languageTag: preferences.languageTag,
        research,
        systemPrompt: preferences.customSystemPrompt,
      });
      if (
        !researchAllowed &&
        (generated.sources.length ||
          generated.content.evidence.some((item) => item.sourceIds.length))
      ) {
        throw domainError(
          "invalid-provider-output",
          "report-generation",
          "The provider returned citations without research consent.",
        );
      }
      const completedAt = now().toISOString();
      const report = await dependencies.repositories.reports.appendRevision({
        captureId: job.captureId,
        expectedGeneration: job.generation,
        requestId: job.requestId,
        expectedActiveRevision: job.payload.expectedActiveRevision,
        phase: capture.transcript.phase,
        origin: "ai-generated",
        transcriptRevision: job.payload.transcriptRevision,
        content: generated.content,
        provenance: providerProvenance(
          completedAt,
          job.payload.expectedActiveRevision,
        ),
        explicitlyReplacedUserFields:
          job.payload.explicitlyReplacedUserFields ?? [],
        sources: generated.sources,
        providerId: provider.descriptor.id,
        model: context.selection.model,
        captureUpdate: isProvisional
          ? null
          : {
              title: generated.title,
              summary: generated.summary,
              kind: generated.kind,
              status: "ready",
              updatedAt: completedAt,
            },
        createdAt: completedAt,
      });
      if (
        !isProvisional &&
        preferences.notifications.enabled &&
        preferences.notifications.reportReady &&
        dependencies.notifications
      ) {
        try {
          await dependencies.notifications.schedule(
            `report:${job.captureId}:${report.revision}`,
            {
              type: "processing-complete",
              captureId: job.captureId,
            },
          );
        } catch {
          // Report persistence is authoritative; optional notification failure must not roll it back.
        }
      }
    },
  };
}
export function createTerminalFailureHandler(
  dependencies: ProcessingHandlerDependencies,
) {
  const now = dependencies.now ?? (() => new Date());
  return async (job: JobRecord, error: NormalizedError) => {
    const failedAt = now().toISOString();
    try {
      const capture = await dependencies.repositories.captures.get(
        job.captureId,
      );
      if (capture && capture.generation !== job.generation) return;
      await dependencies.repositories.captures.setProcessingState(
        job.captureId,
        "failed",
        error,
        failedAt,
        job.generation,
      );
      const preferences = await dependencies.repositories.preferences.get();
      if (
        job.kind === "transcribe-capture" &&
        capture?.transcript?.phase === "provisional" &&
        capture.transcript.text.trim()
      ) {
        await dependencies.repositories.jobs.enqueue(
          reportJob({
            captureId: job.captureId,
            generation: job.generation,
            revision: job.revision,
            requestId: `${job.requestId}:report`,
            transcriptRevision: capture.transcript.revision,
            expectedActiveRevision: null,
            researchEnabled: preferences.researchEnabled,
            reason: "initial-capture",
            explicitlyReplacedUserFields: [],
            runAfter: failedAt,
            maxAttempts: dependencies.maxReportAttempts ?? 3,
          }),
        );
      }
      if (
        preferences.notifications.enabled &&
        preferences.notifications.processingFailed &&
        dependencies.notifications
      ) {
        await dependencies.notifications.schedule(
          `failed:${job.captureId}:${job.kind}:${job.revision}`,
          {
            type: "processing-failed",
            captureId: job.captureId,
          },
        );
      }
    } catch {
      // Deletion may win while provider work is in flight; no late result is restored.
    }
  };
}
function requireMatchingTranscript(
  capture: CaptureRecord | null,
  revision: number,
): asserts capture is CaptureRecord &
  Readonly<{ transcript: NonNullable<CaptureRecord["transcript"]> }> {
  if (!capture)
    throw domainError(
      "not-found",
      "report-generation",
      "The capture was deleted.",
    );
  if (!capture.transcript || capture.transcript.revision !== revision) {
    throw domainError(
      "conflict",
      "report-generation",
      "The report job no longer matches the transcript.",
    );
  }
}
