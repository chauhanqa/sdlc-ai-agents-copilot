import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { buildApiApp } from "../app.js";
import type { AppConfig } from "../config.js";
import { setSessionCookie, clearSessionCookie } from "./cookies.js";
import type { NewSession, SessionRepository } from "./session-repository.js";
import {
  createSessionService,
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_SECONDS,
} from "./sessions.js";

const userId = "fe809e84-3bfe-4c6b-a138-121524243454";
const signingKey = new TextEncoder().encode(
  "test-only-signing-key-with-at-least-32-bytes",
);
const fixedNow = new Date("2026-10-13T18:00:00.000Z");

class MemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, NewSession & { revoked: boolean }>();
  readonly activeUsers = new Set([userId]);

  async createActiveSession(session: NewSession): Promise<boolean> {
    if (!this.activeUsers.has(session.userId)) {
      return false;
    }
    this.sessions.set(session.jti, { ...session, revoked: false });
    return true;
  }

  async isActiveSession(
    jti: string,
    sessionUserId: string,
    expiresAtSeconds: number,
  ): Promise<boolean> {
    const session = this.sessions.get(jti);
    return (
      session !== undefined &&
      session.userId === sessionUserId &&
      Math.floor(session.expiresAt.getTime() / 1000) === expiresAtSeconds &&
      !session.revoked &&
      this.activeUsers.has(sessionUserId)
    );
  }

  async revokeSession(jti: string, sessionUserId: string): Promise<void> {
    const session = this.sessions.get(jti);
    if (session?.userId === sessionUserId) {
      session.revoked = true;
    }
  }
}

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    databaseUrl: "postgresql://localhost/sports_paradise",
    environment: "test",
    jwtSigningKey: signingKey,
    webOrigin: "http://localhost:5173",
    secureCookies: false,
    ...overrides,
  };
}

describe("JWT session lifecycle", () => {
  it("issues a signed HS256 token backed by an active persisted 24-hour session", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );

    const issued = await service.issue(userId);
    const session = repository.sessions.get(issued.session.jti);
    const [header] = issued.token.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    expect(
      issued.session.expiresAt - Math.floor(fixedNow.getTime() / 1000),
    ).toBe(SESSION_LIFETIME_SECONDS);
    expect(session?.revoked).toBe(false);
    await expect(service.authenticate(issued.token)).resolves.toEqual(
      issued.session,
    );
  });

  it("does not issue sessions for inactive or unknown accounts", async () => {
    const repository = new MemorySessionRepository();
    repository.activeUsers.clear();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );

    await expect(service.issue(userId)).rejects.toThrow(
      "Cannot create a session for an inactive account.",
    );
    expect(repository.sessions).toHaveLength(0);
  });

  it("rejects malformed tokens, tampered signatures, and algorithm substitution", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const issued = await service.issue(userId);
    const substitutedToken = await new SignJWT({
      jti: issued.session.jti,
    })
      .setProtectedHeader({ alg: "HS384", typ: "JWT" })
      .setIssuer("sports-paradise-api")
      .setAudience("sports-paradise-web")
      .setSubject(userId)
      .setIssuedAt(Math.floor(fixedNow.getTime() / 1000))
      .setExpirationTime(
        Math.floor(fixedNow.getTime() / 1000) + SESSION_LIFETIME_SECONDS,
      )
      .sign(signingKey);

    await expect(service.authenticate("not.a.jwt")).resolves.toBeNull();
    await expect(
      service.authenticate(`${issued.token}tampered`),
    ).resolves.toBeNull();
    await expect(service.authenticate(substitutedToken)).resolves.toBeNull();
    await expect(
      createSessionService(
        repository,
        new TextEncoder().encode("another-key-that-is-at-least-32-bytes"),
      ).authenticate(issued.token),
    ).resolves.toBeNull();
  });

  it("rejects expired, unknown, revoked, and deactivated-account sessions", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const issued = await service.issue(userId);
    const issuedAt = Math.floor(fixedNow.getTime() / 1000) - 60;
    const expiredToken = await new SignJWT({ jti: issued.session.jti })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("sports-paradise-api")
      .setAudience("sports-paradise-web")
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 1)
      .sign(signingKey);

    await expect(service.authenticate(expiredToken)).resolves.toBeNull();
    await expect(
      service.authenticate(
        await new SignJWT({
          jti: "f42e1ce9-2055-4592-9b16-2187518ab048",
        })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setIssuer("sports-paradise-api")
          .setAudience("sports-paradise-web")
          .setSubject(userId)
          .setIssuedAt(Math.floor(fixedNow.getTime() / 1000))
          .setExpirationTime(
            Math.floor(fixedNow.getTime() / 1000) + SESSION_LIFETIME_SECONDS,
          )
          .sign(signingKey),
      ),
    ).resolves.toBeNull();

    await service.revoke(issued.session);
    await expect(service.authenticate(issued.token)).resolves.toBeNull();

    const another = await service.issue(userId);
    repository.activeUsers.delete(userId);
    await expect(service.authenticate(another.token)).resolves.toBeNull();
  });

  it("rejects tokens with an invalid claim lifetime", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const issuedAt = Math.floor(fixedNow.getTime() / 1000);
    const token = await new SignJWT({
      jti: "f42e1ce9-2055-4592-9b16-2187518ab048",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("sports-paradise-api")
      .setAudience("sports-paradise-web")
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + SESSION_LIFETIME_SECONDS - 1)
      .sign(signingKey);

    await expect(service.authenticate(token)).resolves.toBeNull();
  });
});

describe("session cookie and logout", () => {
  it("sets and clears a scoped HttpOnly SameSite=Lax cookie", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const issued = await service.issue(userId);
    const app = buildApiApp(testConfig({ secureCookies: true }), {
      sessionRepository: repository,
      sessionService: service,
    });
    app.post("/test/session-cookie", async (_request, reply) => {
      setSessionCookie(reply, "sample.jwt.token", true);
      return reply.code(204).send();
    });
    app.post("/test/clear-cookie", async (_request, reply) => {
      clearSessionCookie(reply, true);
      return reply.code(204).send();
    });

    try {
      for (const url of ["/test/session-cookie", "/test/clear-cookie"]) {
        const denied = await app.inject({ method: "POST", url });
        expect(denied.statusCode, url).toBe(401);
        expect(denied.json(), url).toEqual({
          error: "Authentication required.",
        });
      }

      const headers = {
        cookie: `${SESSION_COOKIE_NAME}=${issued.token}`,
      };
      const setResponse = await app.inject({
        method: "POST",
        url: "/test/session-cookie",
        headers,
      });
      expect(setResponse.statusCode).toBe(204);
      const setCookie = setResponse.headers["set-cookie"];
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=sample.jwt.token`);
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).toContain("Max-Age=86400");
      expect(setCookie).toContain("Secure");

      const clearResponse = await app.inject({
        method: "POST",
        url: "/test/clear-cookie",
        headers,
      });
      expect(clearResponse.statusCode).toBe(204);
      const clearedCookie = clearResponse.headers["set-cookie"];
      expect(clearedCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(clearedCookie).toContain("Max-Age=0");
      expect(clearedCookie).toContain("HttpOnly");
    } finally {
      await app.close();
    }
  });

  it("logout revokes only the current session and denies missing authentication", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const first = await service.issue(userId);
    const second = await service.issue(userId);
    const app = buildApiApp(testConfig(), {
      sessionRepository: repository,
      sessionService: service,
    });

    const denied = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: "Authentication required." });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        origin: "http://localhost:5173",
        cookie: `${SESSION_COOKIE_NAME}=${first.token}`,
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    await expect(service.authenticate(first.token)).resolves.toBeNull();
    await expect(service.authenticate(second.token)).resolves.toEqual(
      second.session,
    );
    await app.close();
  });

  it("rejects cross-origin logout before changing the session", async () => {
    const repository = new MemorySessionRepository();
    const service = createSessionService(
      repository,
      signingKey,
      () => fixedNow,
    );
    const issued = await service.issue(userId);
    const app = buildApiApp(testConfig(), { sessionRepository: repository });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        origin: "https://untrusted.example",
        cookie: `${SESSION_COOKIE_NAME}=${issued.token}`,
      },
    });
    expect(response.statusCode).toBe(403);
    await expect(service.authenticate(issued.token)).resolves.toEqual(
      issued.session,
    );
    await app.close();
  });
});
