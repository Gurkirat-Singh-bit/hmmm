/**
 * @file secure-storage.ts
 * @description Android keystore-backed provider credential storage.
 * @author Gurkirat Singh
 * @license MIT
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type {
  ActiveCredential,
  CredentialKind,
  CredentialVersion,
  SecretStorePort,
} from "@/features/domain/contracts";
import { domainError } from "@/features/domain/errors";

const ACTIVE_CREDENTIAL_KEYS: Readonly<Record<CredentialKind, string>> = {
  speech: "hmmm.credentials.speech",
  ai: "hmmm.credentials.ai",
};

type StoredCredential = Readonly<{
  version: CredentialVersion;
  secret: string;
}>;

/** Rejects unsupported platforms before accessing platform-owned secret storage. */
function requireAndroid(): void {
  if (Platform.OS !== "android") {
    throw domainError(
      "unsupported",
      "provider-configuration",
      "Protected provider credentials are currently supported on Android only.",
    );
  }
}

/** Parses one protected credential without exposing malformed values to callers. */
function parseCredential(
  kind: CredentialKind,
  value: string | null,
): ActiveCredential | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredCredential>;
    if (
      typeof parsed.version !== "string" ||
      !parsed.version ||
      typeof parsed.secret !== "string" ||
      !parsed.secret.trim()
    ) {
      throw new Error("invalid");
    }
    return { kind, version: parsed.version, secret: parsed.secret };
  } catch {
    throw domainError(
      "storage-failed",
      "provider-configuration",
      "A protected provider credential is unreadable. Re-enter it in Settings.",
      true,
    );
  }
}

/**
 * Stores provider credentials only in SecureStore.
 *
 * Reads and writes are asynchronous and may reject when the Android keystore
 * is unavailable. No secret value is written to SQLite, logs, or exports.
 */
export const providerCredentials: SecretStorePort = {
  async readActive(kind) {
    requireAndroid();
    return parseCredential(
      kind,
      await SecureStore.getItemAsync(ACTIVE_CREDENTIAL_KEYS[kind]),
    );
  },
  async activate(input) {
    requireAndroid();
    const secret = input.secret.trim();
    if (!secret || !input.version.trim()) {
      throw domainError(
        "configuration-missing",
        "provider-configuration",
        "A provider credential is required.",
      );
    }
    await SecureStore.setItemAsync(
      ACTIVE_CREDENTIAL_KEYS[input.kind],
      JSON.stringify({
        version: input.version,
        secret,
      } satisfies StoredCredential),
    );
  },
  async deleteVersion(kind, version) {
    requireAndroid();
    const active = parseCredential(
      kind,
      await SecureStore.getItemAsync(ACTIVE_CREDENTIAL_KEYS[kind]),
    );
    if (active?.version === version)
      await SecureStore.deleteItemAsync(ACTIVE_CREDENTIAL_KEYS[kind]);
  },
  async clear() {
    requireAndroid();
    await Promise.all(
      Object.values(ACTIVE_CREDENTIAL_KEYS).map((key) =>
        SecureStore.deleteItemAsync(key),
      ),
    );
  },
};

/** Creates an opaque version marker used to correlate a secret with its selection. */
export function createCredentialVersion(): CredentialVersion {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
