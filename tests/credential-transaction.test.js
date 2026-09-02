/**
 * @file credential-transaction.test.js
 * @description Verifies protected credentials roll back when activation or preference publication fails.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, test } from "bun:test";

import { commitCredentialChange } from "../src/features/onboarding/credential-transaction";

function credential(kind, version) {
  return { kind, version, secret: `${version}-secret` };
}

function fakeSecrets(initial, failOnVersion = null) {
  const active = new Map(Object.entries(initial));
  return {
    active,
    async readActive(kind) {
      return active.get(kind) ?? null;
    },
    async activate(value) {
      if (value.version === failOnVersion) throw new Error("keystore failed");
      active.set(value.kind, value);
    },
    async deleteVersion(kind, version) {
      if (active.get(kind)?.version === version) active.delete(kind);
    },
    async clear() {
      active.clear();
    },
  };
}

describe("credential transaction", () => {
  test("publishes selections after both credentials activate", async () => {
    const secrets = fakeSecrets({});
    let published = false;
    await commitCredentialChange(
      secrets,
      {
        speech: credential("speech", "speech-next"),
        ai: credential("ai", "ai-next"),
      },
      async () => {
        published = true;
      },
    );
    expect(published).toBe(true);
    expect(secrets.active.get("speech").version).toBe("speech-next");
    expect(secrets.active.get("ai").version).toBe("ai-next");
  });

  test("restores prior credentials when the second activation fails", async () => {
    const previous = {
      speech: credential("speech", "speech-old"),
      ai: credential("ai", "ai-old"),
    };
    const secrets = fakeSecrets(previous, "ai-next");
    await expect(
      commitCredentialChange(
        secrets,
        {
          speech: credential("speech", "speech-next"),
          ai: credential("ai", "ai-next"),
        },
        async () => undefined,
      ),
    ).rejects.toThrow("keystore failed");
    expect(secrets.active.get("speech")).toEqual(previous.speech);
    expect(secrets.active.get("ai")).toEqual(previous.ai);
  });

  test("restores prior credentials when preference publication fails", async () => {
    const previous = {
      speech: credential("speech", "speech-old"),
      ai: credential("ai", "ai-old"),
    };
    const secrets = fakeSecrets(previous);
    await expect(
      commitCredentialChange(
        secrets,
        {
          speech: credential("speech", "speech-next"),
          ai: credential("ai", "ai-next"),
        },
        async () => {
          throw new Error("sqlite failed");
        },
      ),
    ).rejects.toThrow("sqlite failed");
    expect(secrets.active.get("speech")).toEqual(previous.speech);
    expect(secrets.active.get("ai")).toEqual(previous.ai);
  });

  test("replaces and rolls back the protected search credential", async () => {
    const previous = { search: credential("search", "search-old") };
    const secrets = fakeSecrets(previous);
    await expect(
      commitCredentialChange(
        secrets,
        { search: credential("search", "search-next") },
        async () => {
          throw new Error("sqlite failed");
        },
      ),
    ).rejects.toThrow("sqlite failed");
    expect(secrets.active.get("search")).toEqual(previous.search);

    await commitCredentialChange(
      secrets,
      { search: credential("search", "search-next") },
      async () => undefined,
    );
    expect(secrets.active.get("search").version).toBe("search-next");
  });
});
