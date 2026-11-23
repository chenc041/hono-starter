import { describe, expect, test } from "bun:test";
import { InMemoryAuthIdentityStore } from "~/modules/auth/identity-store";
import { hashToken, InMemoryAuthTokenStore as InMemoryTokenStore } from "~/modules/auth/token-store";

describe("in-memory auth stores", () => {
  test("identity store returns configured users and rejects missing users", async () => {
    const store = new InMemoryAuthIdentityStore();
    store.setUser("admin@example.com", "admin12345", "user-1");

    expect(await store.verifyCredentials("admin@example.com", "admin12345")).toEqual({
      sub: "user-1",
      email: "admin@example.com",
    });
    expect(await store.verifyCredentials("admin@example.com", "wrong-password")).toBeNull();
    expect(await store.verifyCredentials("missing@example.com", "admin12345")).toBeNull();
  });

  test("token store rotates and rejects expired or revoked refresh tokens", async () => {
    const store = new InMemoryTokenStore();
    const oldTokenHash = hashToken("old-refresh-token");
    const newTokenHash = hashToken("new-refresh-token");

    await store.saveRefreshToken({
      tokenHash: oldTokenHash,
      userId: "user-1",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await store.findActiveRefreshToken(oldTokenHash)).not.toBeNull();

    await store.revokeRefreshToken(oldTokenHash, newTokenHash);
    expect(await store.findActiveRefreshToken(oldTokenHash)).toBeNull();

    await store.revokeAccessToken({
      tokenHash: hashToken("access-token"),
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      reason: "LOGOUT",
    });

    expect(await store.isAccessTokenRevoked(hashToken("access-token"))).toBe(true);
    expect(await store.isAccessTokenRevoked(hashToken("unknown-token"))).toBe(false);
  });

  test("token store rejects expired refresh tokens", async () => {
    const store = new InMemoryTokenStore();
    await store.saveRefreshToken({
      tokenHash: hashToken("expired"),
      userId: "user-1",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() - 60_000),
    });

    expect(await store.findActiveRefreshToken(hashToken("expired"))).toBeNull();
  });
});
