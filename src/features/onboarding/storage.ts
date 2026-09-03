/**
 * @file storage.ts
 * @description Coordinates SQLite setup preferences with protected credentials.
 * @author Gurkirat Singh
 * @license MIT
 */

import { openAppDatabase, type AppDatabase } from "@/features/storage/database";
import type {
  AppPreferencesRecord,
  NotificationPreferences,
  ResearchConsent,
  ResearchSource,
} from "@/features/domain/contracts";
import { domainError } from "@/features/domain/errors";
import {
  createCredentialVersion,
  providerCredentials,
} from "@/features/storage/secure-storage";
import { normalizeReportSystemPrompt } from "@/features/provider/llm/prompts";
import { commitCredentialChange } from "./credential-transaction";

export { providerCredentials };

export type AppLanguage = "English";
export type OnboardingProfile = Readonly<{
  name: string;
  speechProvider: string;
  speechModel: string;
  speechKey: string;
  speechEndpoint: string;
  aiProvider: string;
  aiModel: string;
  aiKey: string;
  aiEndpoint: string;
  researchSource?: ResearchSource;
  researchConsent?: ResearchConsent["status"];
  searchKey?: string;
}>;
export type SetupSaveOptions = Readonly<{
  onboardingComplete?: boolean;
  researchEnabled?: boolean;
  researchConsent?: Exclude<ResearchConsent["status"], "unknown">;
}>;

const RESEARCH_CONSENT_VERSION = "research-transfer-v2";
let databasePromise: Promise<AppDatabase> | null = null;
let setupWriteTail: Promise<void> = Promise.resolve();

/** Opens the shared database and permits a later retry after an open failure. */
function database(): Promise<AppDatabase> {
  if (!databasePromise) {
    databasePromise = openAppDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/** Serializes preference and credential changes to prevent overlapping setup writes. */
function queueSetupWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = setupWriteTail.then(operation, operation);
  setupWriteTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Reads non-secret application preferences from SQLite. */
export async function readPreferences(): Promise<AppPreferencesRecord> {
  return (await database()).repositories.preferences.get();
}

/** Reads the currently supported app language. */
export async function readLanguage(): Promise<AppLanguage> {
  await readPreferences();
  return "English";
}

/** Persists the supported app language. */
export async function saveLanguage(_language: AppLanguage): Promise<void> {
  const app = await database();
  const current = await app.repositories.preferences.get();
  await app.repositories.preferences.save({
    ...current,
    languageTag: "en",
    updatedAt: new Date().toISOString(),
  });
}

/** Persists research enablement and the matching explicit consent decision. */
export async function saveResearchPreferences(
  input: Readonly<{
    enabled: boolean;
    consent: Exclude<ResearchConsent["status"], "unknown">;
    source?: ResearchSource;
    searchKey?: string;
  }>,
): Promise<void> {
  return queueSetupWrite(async () => {
    const app = await database();
    const current = await app.repositories.preferences.get();
    const now = new Date().toISOString();
    const source = input.source ?? current.researchSource;
    const searchKey = input.searchKey?.trim();
    if (
      source.kind === "external" &&
      input.enabled &&
      !searchKey &&
      !(await providerCredentials.readActive("search"))?.secret.trim()
    ) {
      throw domainError(
        "configuration-missing",
        "provider-configuration",
        "Add a SerpApi key before enabling external research.",
      );
    }
    await commitCredentialChange(
      providerCredentials,
      searchKey
        ? {
            search: {
              kind: "search",
              version: createCredentialVersion(),
              secret: searchKey,
            },
          }
        : {},
      () =>
        app.repositories.preferences.save({
          ...current,
          researchEnabled: input.enabled,
          researchConsent: {
            status: input.consent,
            policyVersion: RESEARCH_CONSENT_VERSION,
            decidedAt: now,
          },
          researchSource: source,
          updatedAt: now,
        }),
    );
  });
}

/**
 * Persists validated report instructions in SQLite; null restores the built-in prompt.
 * Validation errors reject before any preference write occurs.
 */
export async function saveCustomSystemPrompt(
  customSystemPrompt: string | null,
): Promise<void> {
  const normalized = normalizeReportSystemPrompt(customSystemPrompt);
  const app = await database();
  const current = await app.repositories.preferences.get();
  await app.repositories.preferences.save({
    ...current,
    customSystemPrompt: normalized,
    updatedAt: new Date().toISOString(),
  });
}

/** Persists local notification choices without storing OS permission state. */
export async function saveNotificationPreferences(
  notifications: NotificationPreferences,
): Promise<void> {
  const app = await database();
  const current = await app.repositories.preferences.get();
  await app.repositories.preferences.save({
    ...current,
    notifications,
    updatedAt: new Date().toISOString(),
  });
}

/** Returns whether setup is complete. */
export async function isOnboardingComplete(): Promise<boolean> {
  return (await readPreferences()).onboardingComplete;
}

/** Builds the editable setup profile with credentials held only in memory. */
export async function readProfile(): Promise<OnboardingProfile | null> {
  const preferences = await readPreferences();
  const [speech, ai, search] = await Promise.all([
    providerCredentials.readActive("speech"),
    providerCredentials.readActive("ai"),
    providerCredentials.readActive("search"),
  ]);
  if (
    !preferences.displayName &&
    !preferences.onboardingComplete &&
    !speech &&
    !ai
  )
    return null;
  return {
    name: preferences.displayName,
    speechProvider: preferences.speechProvider.providerId,
    speechModel: preferences.speechProvider.model,
    speechKey: speech?.secret ?? "",
    speechEndpoint: preferences.speechProvider.endpoint ?? "",
    aiProvider: preferences.aiProvider.providerId,
    aiModel: preferences.aiProvider.model,
    aiKey: ai?.secret ?? "",
    aiEndpoint: preferences.aiProvider.endpoint ?? "",
    researchSource: preferences.researchSource,
    researchConsent: preferences.researchConsent.status,
    searchKey: search?.secret ?? "",
  };
}

/**
 * Writes secrets to SecureStore before publishing their non-secret SQLite selections.
 * The returned promise rejects on keystore or database failures.
 */
export function saveProfile(
  profile: OnboardingProfile,
  options: SetupSaveOptions = {},
): Promise<void> {
  return queueSetupWrite(async () => {
    const app = await database();
    const current = await app.repositories.preferences.get();
    const now = new Date().toISOString();
    const searchKey = profile.searchKey?.trim();
    await commitCredentialChange(
      providerCredentials,
      {
        speech: {
          kind: "speech",
          version: createCredentialVersion(),
          secret: profile.speechKey,
        },
        ai: {
          kind: "ai",
          version: createCredentialVersion(),
          secret: profile.aiKey,
        },
        ...(searchKey
          ? {
              search: {
                kind: "search" as const,
                version: createCredentialVersion(),
                secret: searchKey,
              },
            }
          : {}),
      },
      () =>
        app.repositories.preferences.save({
          ...current,
          displayName: profile.name.trim(),
          onboardingComplete:
            options.onboardingComplete ?? current.onboardingComplete,
          researchEnabled: options.researchEnabled ?? current.researchEnabled,
          researchConsent: options.researchConsent
            ? {
                status: options.researchConsent,
                policyVersion: RESEARCH_CONSENT_VERSION,
                decidedAt: now,
              }
            : current.researchConsent,
          researchSource: profile.researchSource ?? current.researchSource,
          speechProvider: {
            providerId: profile.speechProvider,
            model: profile.speechModel.trim(),
            endpoint: profile.speechEndpoint.trim() || null,
          },
          aiProvider: {
            providerId: profile.aiProvider,
            model: profile.aiModel.trim(),
            endpoint: profile.aiEndpoint.trim() || null,
          },
          updatedAt: now,
        }),
    );
  });
}

/** Clears every provider credential during a confirmed full reset. */
export async function clearSetupMetadata(): Promise<void> {
  await providerCredentials.clear();
}
