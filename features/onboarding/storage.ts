/**
 * Setup persistence keeps provider selections in SQLite and credentials in Android SecureStore.
 * `OnboardingProfile` remains an ephemeral compatibility DTO for existing provider callers.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { openAppDatabase, type AppDatabase } from '@/features/database/database';
import type {
  ActiveCredential,
  AppPreferencesRecord,
  CredentialKind,
  CredentialVersion,
  NotificationPreferences,
  ResearchConsent,
  SecretStorePort,
} from '@/features/domain/contracts';
import { domainError } from '@/features/domain/errors';

export type AppLanguage = 'English' | 'Hindi' | 'Punjabi';

/** Credentials are present only while a caller is preparing an immediate provider request. */
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
}>;

export type SetupSaveOptions = Readonly<{
  onboardingComplete?: boolean;
  researchEnabled?: boolean;
  researchConsent?: Exclude<ResearchConsent['status'], 'unknown'>;
}>;

const migrationVersion = '3';
const researchConsentVersion = 'research-transfer-v1';
const migrationKey = 'hmmm.setup-migration';
const setupJournalKey = 'hmmm.setup-journal.v1';
const setupCommitKey = 'hmmm.setup-commit.v1';
const legacyKeys = {
  complete: 'hmmm.onboarding-complete',
  name: 'hmmm.profile-name',
  speechProvider: 'hmmm.speech-provider',
  speechModel: 'hmmm.speech-model',
  speech: 'hmmm.speech-key',
  speechEndpoint: 'hmmm.speech-endpoint',
  aiProvider: 'hmmm.ai-provider',
  aiModel: 'hmmm.ai-model',
  ai: 'hmmm.ai-key',
  aiEndpoint: 'hmmm.ai-endpoint',
  language: 'hmmm.app-language',
} as const;

const credentialKeys = {
  pointer: (kind: CredentialKind) => `hmmm.credentials.v1.${kind}.active`,
  versions: (kind: CredentialKind) => `hmmm.credentials.v1.${kind}.versions`,
  slot: (kind: CredentialKind, version: CredentialVersion) => `hmmm.credentials.v1.${kind}.${version}`,
} as const;

let databasePromise: Promise<AppDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;
let setupWriteTail: Promise<void> = Promise.resolve();
let storageReady = false;

function requireAndroid() {
  if (Platform.OS !== 'android') throw new Error('Hmmmidea setup is available on Android only.');
}

function database() {
  if (!databasePromise) {
    databasePromise = openAppDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function credentialVersion() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`.replace(/[^A-Za-z0-9_-]/gu, '');
}

async function versions(kind: CredentialKind) {
  const raw = await SecureStore.getItemAsync(credentialKeys.versions(kind));
  if (!raw) return [] as CredentialVersion[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every(isCredentialVersion) && new Set(parsed).size === parsed.length) return parsed;
  } catch {
    // Keep the manifest intact so reset can report failure instead of
    // deleting an index that may still reference unknown credential slots.
  }
  throw new Error('The protected credential index is invalid.');
}

type CredentialPointers = Readonly<{
  speech: CredentialVersion | null;
  ai: CredentialVersion | null;
}>;

type SetupJournal = Readonly<{
  schemaVersion: 1;
  operationId: string;
  previous: Readonly<{ preferences: AppPreferencesRecord; credentials: CredentialPointers }>;
  next: Readonly<{ preferences: AppPreferencesRecord; credentials: CredentialPointers }>;
}>;

type CredentialSnapshot = Readonly<{
  pointer: CredentialVersion | null;
  known: readonly CredentialVersion[];
  slots: ReadonlyMap<CredentialVersion, string | null>;
}>;

function setupFailure() {
  return domainError(
    'storage-failed',
    'provider-configuration',
    'Protected provider setup could not be recovered. Repair provider settings to continue.',
    true,
  );
}

function setupProjection(preferences: AppPreferencesRecord) {
  return JSON.stringify({
    displayName: preferences.displayName,
    onboardingComplete: preferences.onboardingComplete,
    researchEnabled: preferences.researchEnabled,
    researchConsent: preferences.researchConsent,
    speechProvider: preferences.speechProvider,
    aiProvider: preferences.aiProvider,
  });
}

function isCredentialVersion(value: unknown): value is CredentialVersion {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function parseSetupJournal(raw: string): SetupJournal {
  try {
    const value = JSON.parse(raw) as Partial<SetupJournal>;
    if (!value || value.schemaVersion !== 1 || !isCredentialVersion(value.operationId)
      || !value.previous || !value.next
      || !value.previous.preferences || !value.next.preferences
      || !value.previous.credentials || !value.next.credentials) throw new Error('invalid');
    for (const credentials of [value.previous.credentials, value.next.credentials]) {
      if (![credentials.speech, credentials.ai].every((version) => version === null || isCredentialVersion(version))) {
        throw new Error('invalid');
      }
    }
    return value as SetupJournal;
  } catch {
    throw setupFailure();
  }
}

async function credentialSnapshot(kind: CredentialKind): Promise<CredentialSnapshot> {
  try {
    const pointer = await SecureStore.getItemAsync(credentialKeys.pointer(kind));
    const known = await versions(kind);
    const slots = new Map<CredentialVersion, string | null>();
    for (const version of known) slots.set(version, await SecureStore.getItemAsync(credentialKeys.slot(kind, version)));
    if (pointer === null && known.length) throw new Error('inconsistent');
    if (pointer !== null && (!known.includes(pointer) || !slots.get(pointer)?.trim())) throw new Error('inconsistent');
    if ([...slots.values()].some((secret) => !secret?.trim())) throw new Error('inconsistent');
    return { pointer, known, slots };
  } catch {
    throw setupFailure();
  }
}

async function rawCredentialSnapshot(kind: CredentialKind) {
  const pointer = await SecureStore.getItemAsync(credentialKeys.pointer(kind));
  const known = await versions(kind);
  const slots = new Map<CredentialVersion, string | null>();
  for (const version of known) slots.set(version, await SecureStore.getItemAsync(credentialKeys.slot(kind, version)));
  return { pointer, known, slots };
}

async function validateCredentialStore() {
  await Promise.all([credentialSnapshot('speech'), credentialSnapshot('ai')]);
}

async function convergeCredential(kind: CredentialKind, target: CredentialVersion | null, remove: CredentialVersion | null) {
  const current = await rawCredentialSnapshot(kind);
  if (target) {
    const secret = current.slots.get(target);
    if (!secret?.trim()) throw setupFailure();
    const known = current.known.includes(target) ? current.known : [...current.known, target];
    if (!current.known.includes(target)) await SecureStore.setItemAsync(credentialKeys.versions(kind), JSON.stringify(known));
    await SecureStore.setItemAsync(credentialKeys.pointer(kind), target);
    if (remove && remove !== target) {
      if (known.includes(remove)) await SecureStore.setItemAsync(credentialKeys.versions(kind), JSON.stringify(known.filter((version) => version !== remove)));
      await SecureStore.deleteItemAsync(credentialKeys.slot(kind, remove));
    }
    return;
  }

  if (current.pointer && current.pointer !== remove) throw setupFailure();
  if (remove) {
    await SecureStore.deleteItemAsync(credentialKeys.pointer(kind));
    if (current.known.includes(remove)) await SecureStore.setItemAsync(credentialKeys.versions(kind), JSON.stringify(current.known.filter((version) => version !== remove)));
    await SecureStore.deleteItemAsync(credentialKeys.slot(kind, remove));
  } else if (current.pointer) {
    await SecureStore.deleteItemAsync(credentialKeys.pointer(kind));
  }
}

async function reconcileSetupJournal() {
  const [raw, commit] = await Promise.all([
    SecureStore.getItemAsync(setupJournalKey),
    SecureStore.getItemAsync(setupCommitKey),
  ]);
  if (!raw) {
    // A commit marker can outlive journal cleanup. The final store validation
    // below decides whether it is safe to discard that marker.
    if (commit) {
      await validateCredentialStore();
      await SecureStore.deleteItemAsync(setupCommitKey);
    }
    return;
  }

  const journal = parseSetupJournal(raw);
  if (commit && commit !== journal.operationId) throw setupFailure();
  const app = await database();
  const current = await app.repositories.preferences.get();
  const currentProjection = setupProjection(current);
  const previousProjection = setupProjection(journal.previous.preferences);
  const nextProjection = setupProjection(journal.next.preferences);
  const useNext = commit === journal.operationId || currentProjection === nextProjection;
  const usePrevious = currentProjection === previousProjection;
  if (!useNext && !usePrevious) throw setupFailure();
  const target = useNext ? journal.next : journal.previous;

  for (const kind of ['speech', 'ai'] as const) {
    await convergeCredential(kind, target.credentials[kind], useNext ? null : journal.next.credentials[kind]);
  }
  await app.repositories.preferences.save({
    ...current,
    ...target.preferences,
    id: 'app',
    updatedAt: target.preferences.updatedAt,
  });
  await SecureStore.setItemAsync(setupCommitKey, journal.operationId);
  await validateCredentialStore();
  await SecureStore.deleteItemAsync(setupJournalKey);
  await SecureStore.deleteItemAsync(setupCommitKey);
}

/** Versioned slots are written before their active pointer changes. */
export const providerCredentials: SecretStorePort = {
  async readActive(kind) {
    requireAndroid();
    if (!storageReady) await ensureStorage();
    const current = await credentialSnapshot(kind);
    if (!current.pointer) return null;
    return { kind, version: current.pointer, secret: current.slots.get(current.pointer)! };
  },

  async activate(input) {
    requireAndroid();
    const secret = input.secret.trim();
    if (!secret) throw new Error('A provider credential is required.');
    if (!isCredentialVersion(input.version)) throw setupFailure();
    const previous = await SecureStore.getItemAsync(credentialKeys.pointer(input.kind));
    const existingSlot = await SecureStore.getItemAsync(credentialKeys.slot(input.kind, input.version));
    const manifest = await versions(input.kind);
    try {
      await SecureStore.setItemAsync(credentialKeys.slot(input.kind, input.version), secret);
      if (!manifest.includes(input.version)) {
        await SecureStore.setItemAsync(credentialKeys.versions(input.kind), JSON.stringify([...manifest, input.version]));
      }
      await SecureStore.setItemAsync(credentialKeys.pointer(input.kind), input.version);
      await credentialSnapshot(input.kind);
    } catch {
      try {
        if (previous) await SecureStore.setItemAsync(credentialKeys.pointer(input.kind), previous);
        else await SecureStore.deleteItemAsync(credentialKeys.pointer(input.kind));
      } catch {
        // Leave the durable setup journal for boot reconciliation.
      }
      try { await SecureStore.setItemAsync(credentialKeys.versions(input.kind), JSON.stringify(manifest)); } catch { /* best effort */ }
      try {
        if (existingSlot === null) await SecureStore.deleteItemAsync(credentialKeys.slot(input.kind, input.version));
        else await SecureStore.setItemAsync(credentialKeys.slot(input.kind, input.version), existingSlot);
      } catch { /* best effort */ }
      throw setupFailure();
    }
  },

  async deleteVersion(kind, version) {
    requireAndroid();
    const active = await SecureStore.getItemAsync(credentialKeys.pointer(kind));
    if (active === version) await SecureStore.deleteItemAsync(credentialKeys.pointer(kind));
    await SecureStore.deleteItemAsync(credentialKeys.slot(kind, version));
    const known = await versions(kind);
    await SecureStore.setItemAsync(credentialKeys.versions(kind), JSON.stringify(known.filter((item) => item !== version)));
  },

  async clear() {
    requireAndroid();
    let firstError: unknown = null;
    for (const kind of ['speech', 'ai'] as const) {
      let active: string | null = null;
      let known: CredentialVersion[] = [];
      let pointerReadable = false;
      let versionsReadable = false;
      try {
        active = await SecureStore.getItemAsync(credentialKeys.pointer(kind));
        pointerReadable = true;
      } catch (error) {
        firstError ??= error;
      }
      try {
        known = await versions(kind);
        versionsReadable = true;
      } catch (error) {
        firstError ??= error;
      }
      let slotFailed = false;
      for (const version of [...new Set([...(known ?? []), ...(active ? [active] : [])])]) {
        try {
          await SecureStore.deleteItemAsync(credentialKeys.slot(kind, version));
        } catch (error) {
          firstError ??= error;
          slotFailed = true;
        }
      }
      // Keep both manifests when a slot could not be removed. A later reset
      // can then enumerate and retry the failed slot instead of orphaning it.
      if (pointerReadable && versionsReadable && !slotFailed) {
        for (const key of [credentialKeys.pointer(kind), credentialKeys.versions(kind)]) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (error) {
            firstError ??= error;
          }
        }
      }
    }
    if (firstError) throw firstError;
  },
};

type LegacyProfile = Readonly<{
  complete: string | null;
  name: string | null;
  speechProvider: string | null;
  speechModel: string | null;
  speechKey: string | null;
  speechEndpoint: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  aiKey: string | null;
  aiEndpoint: string | null;
  language: string | null;
}>;

async function readLegacyProfile(): Promise<LegacyProfile> {
  const values = await Promise.all(Object.values(legacyKeys).map((key) => SecureStore.getItemAsync(key)));
  const [complete, name, speechProvider, speechModel, speechKey, speechEndpoint, aiProvider, aiModel, aiKey, aiEndpoint, language] = values;
  return { complete, name, speechProvider, speechModel, speechKey, speechEndpoint, aiProvider, aiModel, aiKey, aiEndpoint, language };
}

function languageTag(language: string | null | undefined) {
  if (language === 'Hindi') return 'hi';
  if (language === 'Punjabi') return 'pa';
  return 'en';
}

function appLanguage(tag: string): AppLanguage {
  if (tag.toLowerCase().startsWith('hi')) return 'Hindi';
  if (tag.toLowerCase().startsWith('pa')) return 'Punjabi';
  return 'English';
}

function legacyCompletion(value: string | null) {
  return value?.trim().toLowerCase() === 'true';
}

function hasLegacyConfiguration(legacy: LegacyProfile) {
  return Boolean(
    legacy.name || legacy.speechProvider || legacy.speechModel || legacy.speechEndpoint
    || legacy.aiProvider || legacy.aiModel || legacy.aiEndpoint || legacy.language || legacy.complete,
  );
}

function hasConfiguredProvider(preferences: AppPreferencesRecord) {
  return Boolean(
    preferences.speechProvider.providerId || preferences.speechProvider.model || preferences.speechProvider.endpoint
    || preferences.aiProvider.providerId || preferences.aiProvider.model || preferences.aiProvider.endpoint,
  );
}

function preferencesFromLegacy(current: AppPreferencesRecord, legacy: LegacyProfile): AppPreferencesRecord {
  const hasExistingConfiguration = hasConfiguredProvider(current);
  return {
    ...current,
    displayName: hasExistingConfiguration ? current.displayName : legacy.name?.trim() ?? '',
    languageTag: hasExistingConfiguration ? current.languageTag : languageTag(legacy.language),
    // Existing installs are migrated to the consent gate with research enabled,
    // never silently researched. A prior denial always remains disabled.
    researchEnabled: hasExistingConfiguration
      ? current.researchConsent.status === 'denied' ? false
        : current.researchConsent.status === 'granted' ? current.researchEnabled : true
      : legacyCompletion(legacy.complete),
    researchConsent: current.researchConsent.status === 'unknown'
      ? { status: 'unknown', policyVersion: null, decidedAt: null }
      : current.researchConsent,
    notifications: current.notifications,
    speechProvider: hasExistingConfiguration ? current.speechProvider : {
      providerId: legacy.speechProvider?.trim() ?? '',
      model: legacy.speechModel?.trim() ?? '',
      endpoint: legacy.speechEndpoint?.trim() || null,
    },
    aiProvider: hasExistingConfiguration ? current.aiProvider : {
      providerId: legacy.aiProvider?.trim() ?? '',
      model: legacy.aiModel?.trim() ?? '',
      endpoint: legacy.aiEndpoint?.trim() || null,
    },
    // Completion is committed only after both legacy credentials have active SecureStore pointers.
    // An already-complete setup remains usable while a provider repair writes new credential slots.
    onboardingComplete: current.onboardingComplete,
    updatedAt: new Date().toISOString(),
  };
}

async function migrateLegacyCredential(kind: CredentialKind, secret: string | null, legacyKey: string) {
  let active: ActiveCredential | null = null;
  try {
    const current = await credentialSnapshot(kind);
    active = current.pointer ? { kind, version: current.pointer, secret: current.slots.get(current.pointer)! } : null;
  } catch {
    // A process stop can leave a legacy migration between SecureStore writes.
    // The still-present legacy value is authoritative and safe to retry.
    if (!secret?.trim()) throw setupFailure();
    await SecureStore.deleteItemAsync(credentialKeys.pointer(kind));
    await SecureStore.deleteItemAsync(credentialKeys.versions(kind));
  }
  if (!active && secret?.trim()) {
    await providerCredentials.activate({ kind, version: `legacy-${migrationVersion}`, secret: secret.trim() });
  }
  const current = await credentialSnapshot(kind);
  if (current.pointer || !secret?.trim()) await SecureStore.deleteItemAsync(legacyKey);
}

async function cleanupLegacyNonSecret() {
  await Promise.all([
    SecureStore.deleteItemAsync(legacyKeys.complete),
    SecureStore.deleteItemAsync(legacyKeys.name),
    SecureStore.deleteItemAsync(legacyKeys.speechProvider),
    SecureStore.deleteItemAsync(legacyKeys.speechModel),
    SecureStore.deleteItemAsync(legacyKeys.speechEndpoint),
    SecureStore.deleteItemAsync(legacyKeys.aiProvider),
    SecureStore.deleteItemAsync(legacyKeys.aiModel),
    SecureStore.deleteItemAsync(legacyKeys.aiEndpoint),
    SecureStore.deleteItemAsync(legacyKeys.language),
  ]);
}

/** SQLite is committed before a legacy SecureStore value is removed, so an interrupted migration is safe to retry. */
async function migrateLegacyProfile() {
  requireAndroid();
  if ((await SecureStore.getItemAsync(migrationKey)) === migrationVersion) return;
  const [app, legacy] = await Promise.all([database(), readLegacyProfile()]);
  const current = await app.repositories.preferences.get();
  const needsConfigurationMigration = hasLegacyConfiguration(legacy) || hasConfiguredProvider(current);

  if (needsConfigurationMigration) {
    await app.repositories.preferences.save(preferencesFromLegacy(current, legacy));
  }

  await migrateLegacyCredential('speech', legacy.speechKey, legacyKeys.speech);
  await migrateLegacyCredential('ai', legacy.aiKey, legacyKeys.ai);

  const migrated = await app.repositories.preferences.get();
  const [speech, ai] = await Promise.all([credentialSnapshot('speech'), credentialSnapshot('ai')]);
  const hasBothCredentials = Boolean(speech.pointer && ai.pointer);
  if (needsConfigurationMigration) {
    const completionClaim = legacy.complete === null
      ? migrated.onboardingComplete
      : legacyCompletion(legacy.complete);
    await app.repositories.preferences.save({
      ...migrated,
      onboardingComplete: Boolean(completionClaim && hasBothCredentials && migrated.speechProvider.model && migrated.aiProvider.model),
      updatedAt: new Date().toISOString(),
    });
    await cleanupLegacyNonSecret();
  }
  await SecureStore.setItemAsync(migrationKey, migrationVersion);
}

async function ensureStorage() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await reconcileSetupJournal();
      await migrateLegacyProfile();
      await reconcileSetupJournal();
      await validateCredentialStore();
      storageReady = true;
    })().catch((error) => {
      migrationPromise = null;
      storageReady = false;
      throw error;
    });
  }
  return migrationPromise;
}

async function updatePreferences(update: (current: AppPreferencesRecord) => AppPreferencesRecord) {
  const pending = setupWriteTail.then(async () => {
    await ensureStorage();
    const app = await database();
    const current = await app.repositories.preferences.get();
    await app.repositories.preferences.save({ ...update(current), id: 'app', updatedAt: new Date().toISOString() });
    return app.repositories.preferences.get();
  });
  setupWriteTail = pending.then(() => undefined, () => undefined);
  return pending;
}

export async function readPreferences() {
  await ensureStorage();
  return (await database()).repositories.preferences.get();
}

export async function readLanguage(): Promise<AppLanguage> {
  return appLanguage((await readPreferences()).languageTag);
}

export async function saveLanguage(language: AppLanguage) {
  await updatePreferences((current) => ({ ...current, languageTag: languageTag(language) }));
}

export async function saveResearchPreferences(input: Readonly<{
  enabled: boolean;
  consent: Exclude<ResearchConsent['status'], 'unknown'>;
}>) {
  await updatePreferences((current) => ({
    ...current,
    researchEnabled: input.enabled && input.consent === 'granted',
    researchConsent: { status: input.consent, policyVersion: researchConsentVersion, decidedAt: new Date().toISOString() },
  }));
}

export async function saveNotificationPreferences(notifications: NotificationPreferences) {
  await updatePreferences((current) => ({ ...current, notifications }));
}

export async function isOnboardingComplete() {
  const [preferences, speech, ai] = await Promise.all([
    readPreferences(), providerCredentials.readActive('speech'), providerCredentials.readActive('ai'),
  ]);
  return preferences.onboardingComplete && Boolean(speech?.secret && ai?.secret);
}

export async function readProfile(): Promise<OnboardingProfile | null> {
  const [preferences, speech, ai] = await Promise.all([
    readPreferences(), providerCredentials.readActive('speech'), providerCredentials.readActive('ai'),
  ]);
  if (!hasConfiguredProvider(preferences)) return null;
  return {
    name: preferences.displayName,
    speechProvider: preferences.speechProvider.providerId,
    speechModel: preferences.speechProvider.model,
    speechKey: speech?.secret ?? '',
    speechEndpoint: preferences.speechProvider.endpoint ?? '',
    aiProvider: preferences.aiProvider.providerId,
    aiModel: preferences.aiProvider.model,
    aiKey: ai?.secret ?? '',
    aiEndpoint: preferences.aiProvider.endpoint ?? '',
  };
}

/**
 * Rotate versioned credentials and publish their matching non-secret selections.
 * Onboarding opts into completion only after successful live provider probes.
 */
export async function saveProfile(profile: OnboardingProfile, options: SetupSaveOptions = {}) {
  const pending = setupWriteTail.then(async () => {
    await ensureStorage();
    const app = await database();
    const current = await app.repositories.preferences.get();
    const researchConsent = options.researchConsent
      ? { status: options.researchConsent, policyVersion: researchConsentVersion, decidedAt: new Date().toISOString() } as const
      : current.researchConsent;
    const nonSecret = {
      ...current,
      displayName: profile.name.trim(),
      researchEnabled: researchConsent.status === 'denied'
        ? false
        : options.researchConsent
          ? options.researchConsent === 'granted' && (options.researchEnabled ?? current.researchEnabled)
          : options.researchEnabled ?? current.researchEnabled,
      researchConsent,
      speechProvider: {
        providerId: profile.speechProvider.trim(),
        model: profile.speechModel.trim(),
        endpoint: profile.speechEndpoint.trim() || null,
      },
      aiProvider: {
        providerId: profile.aiProvider.trim(),
        model: profile.aiModel.trim(),
        endpoint: profile.aiEndpoint.trim() || null,
      },
      onboardingComplete: options.onboardingComplete ?? current.onboardingComplete,
      updatedAt: new Date().toISOString(),
    } satisfies AppPreferencesRecord;

    const previous = await Promise.all([
      providerCredentials.readActive('speech'),
      providerCredentials.readActive('ai'),
    ]);
    const next = [
      { kind: 'speech' as const, version: credentialVersion(), secret: profile.speechKey },
      { kind: 'ai' as const, version: credentialVersion(), secret: profile.aiKey },
    ];
    const journal: SetupJournal = {
      schemaVersion: 1,
      operationId: credentialVersion(),
      previous: {
        preferences: current,
        credentials: { speech: previous[0]?.version ?? null, ai: previous[1]?.version ?? null },
      },
      next: {
        preferences: nonSecret,
        credentials: { speech: next[0].version, ai: next[1].version },
      },
    };

    // This journal contains only provider selections and credential versions,
    // never credential values. It stays until both stores are reconciled.
    try {
      await SecureStore.setItemAsync(setupJournalKey, JSON.stringify(journal));
    } catch {
      throw setupFailure();
    }
    try {
      await providerCredentials.activate(next[0]);
      await providerCredentials.activate(next[1]);
      await app.repositories.preferences.save(nonSecret);
      await SecureStore.setItemAsync(setupCommitKey, journal.operationId);
      await validateCredentialStore();
      await SecureStore.deleteItemAsync(setupJournalKey);
      await SecureStore.deleteItemAsync(setupCommitKey);
    } catch {
      try { await reconcileSetupJournal(); } catch { /* durable journal retries on next boot */ }
      throw setupFailure();
    }
  });
  setupWriteTail = pending.then(() => undefined, () => undefined);
  return pending;
}

/** Used only by a confirmed full reset after SQLite preferences have been deleted. */
export async function clearSetupMetadata() {
  requireAndroid();
  await Promise.all([
    SecureStore.deleteItemAsync(migrationKey),
    SecureStore.deleteItemAsync(setupJournalKey),
    SecureStore.deleteItemAsync(setupCommitKey),
    ...Object.values(legacyKeys).map((key) => SecureStore.deleteItemAsync(key)),
  ]);
}
