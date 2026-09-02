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
 * Activates provider credentials and publishes their matching preferences as one logical change.
 *
 * @param secrets - Protected storage implementation that owns credential values.
 * @param next - New credentials to activate.
 * @param publish - Persists the matching non-secret provider selections.
 * @returns A promise that resolves after secrets and preferences are committed.
 * @throws A storage error when activation, publication, or rollback fails.
 * @sideEffects Updates protected credential storage and invokes the preference publisher.
 */
export async function commitCredentialChange(
  secrets: SecretStorePort,
  next: Readonly<Partial<Record<CredentialKind, ActiveCredential>>>,
  publish: () => Promise<void>,
): Promise<void> {
  const kinds = Object.keys(next) as CredentialKind[];
  const previous = new Map(
    await Promise.all(
      kinds.map(
        async (kind) => [kind, await secrets.readActive(kind)] as const,
      ),
    ),
  );

  try {
    for (const kind of kinds) await secrets.activate(next[kind]!);
    await publish();
  } catch (error) {
    const rollback = await Promise.allSettled(
      kinds.map((kind) =>
        previous.get(kind)
          ? secrets.activate(previous.get(kind)!)
          : secrets.deleteVersion(kind, next[kind]!.version),
      ),
    );
    if (rollback.some((result) => result.status === "rejected")) {
      throw domainError(
        "storage-failed",
        "provider-configuration",
        "Provider setup failed and protected credentials could not be restored. Re-enter the provider keys.",
        true,
      );
    }
    throw error;
  }
}
