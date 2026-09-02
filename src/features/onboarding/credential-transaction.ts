/**
 * @file credential-transaction.ts
 * @description Rolls protected provider credentials back when publishing setup fails.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  ActiveCredential,
  CredentialKind,
  SecretStorePort,
} from "@/features/domain/contracts";
import { domainError } from "@/features/domain/errors";

/**
 * Activates both provider credentials and publishes their matching preferences as one logical change.
 *
 * @param secrets - Protected storage implementation that owns credential values.
 * @param next - New speech and AI credentials to activate.
 * @param publish - Persists the matching non-secret provider selections.
 * @returns A promise that resolves after secrets and preferences are committed.
 * @throws A storage error when activation, publication, or rollback fails.
 * @sideEffects Updates protected credential storage and invokes the preference publisher.
 */
export async function commitCredentialChange(
  secrets: SecretStorePort,
  next: Readonly<Record<CredentialKind, ActiveCredential>>,
  publish: () => Promise<void>,
): Promise<void> {
  const previous = {
    speech: await secrets.readActive("speech"),
    ai: await secrets.readActive("ai"),
  } as const;

  try {
    await secrets.activate(next.speech);
    await secrets.activate(next.ai);
    await publish();
  } catch (error) {
    const rollback = await Promise.allSettled(
      (["speech", "ai"] as const).map((kind) =>
        previous[kind]
          ? secrets.activate(previous[kind])
          : secrets.deleteVersion(kind, next[kind].version),
      ),
    );
    if (rollback.some((result) => result.status === "rejected")) {
      throw domainError(
        "storage-failed",
        "provider-configuration",
        "Provider setup failed and protected credentials could not be restored. Re-enter both keys.",
        true,
      );
    }
    throw error;
  }
}
