import { describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./config.js";
import { buildApiApp as createApiApp, type AppDependencies } from "./app.js";
import { buildAppConfig, redactConnectionString } from "./config.js";
import { resolveFrontendRoots } from "./frontend-roots.js";
import type {
  AccountCredentials,
  AccountRecord,
} from "./auth/account-repository.js";
import { SESSION_COOKIE_NAME } from "./auth/sessions.js";
import type { SessionService } from "./auth/sessions.js";
import { startServer } from "./server.js";

const testSigningKey = "test-only-signing-key-with-at-least-32-bytes";
const testSessionToken = "valid-session-token";
const testSessionService: SessionService = {
  authenticate: async (token) =>
    token === testSessionToken
      ? {
          userId: "11111111-1111-4111-8111-111111111111",
          jti: "22222222-2222-4222-8222-222222222222",
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        }
      : null,
  issue: async () => {
    throw new Error("not implemented");
  },
  revoke: async () => undefined,
};

const authenticatedHeaders = {
  cookie: `${SESSION_COOKIE_NAME}=${testSessionToken}`,
};

function buildApiApp(config: AppConfig, dependencies: AppDependencies = {}) {
  return createApiApp(config, {
    sessionService: testSessionService,
    ...dependencies,
  });
}

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    databaseUrl: "postgresql://localhost/sports_paradise",
    environment: "test",
    jwtSigningKey: new TextEncoder().encode(testSigningKey),
    webOrigin: "http://localhost:5173",
    secureCookies: false,
    ...overrides,
  };
}

describe("backend API foundation", () => {
  it("resolves the frontend and production output roots from the project root", () => {
    const { webRoot, distRoot } = resolveFrontendRoots();

    expect(webRoot).toBe(
      fileURLToPath(new URL("../../../apps/web", import.meta.url)),
    );
    expect(distRoot).toBe(
      fileURLToPath(new URL("../../../apps/web/dist", import.meta.url)),
    );
  });

  it("validates required configuration values", () => {
    expect(() => buildAppConfig({} as NodeJS.ProcessEnv)).toThrow(
      "DATABASE_URL is required.",
    );
  });

  it("binds the API to loopback by default", () => {
    expect(
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
        JWT_SIGNING_KEY: testSigningKey,
      } as NodeJS.ProcessEnv).host,
    ).toBe("127.0.0.1");
  });

  it("rejects malformed port configuration", () => {
    expect(() =>
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
        PORT: "3e3",
        JWT_SIGNING_KEY: testSigningKey,
      } as NodeJS.ProcessEnv),
    ).toThrow("PORT must be a valid integer between 1 and 65535.");
  });

  it("requires a sufficiently strong JWT signing key at startup", () => {
    expect(() =>
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
      } as NodeJS.ProcessEnv),
    ).toThrow("JWT_SIGNING_KEY is required.");
    expect(() =>
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
        JWT_SIGNING_KEY: "too-short",
      } as NodeJS.ProcessEnv),
    ).toThrow("JWT_SIGNING_KEY must be at least 32 UTF-8 bytes.");
  });

  it("fails server startup when the JWT signing key is missing", async () => {
    await expect(
      startServer({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
      } as NodeJS.ProcessEnv),
    ).rejects.toThrow("JWT_SIGNING_KEY is required.");
  });

  it("normalizes and validates the configured browser origin", () => {
    const config = buildAppConfig({
      DATABASE_URL: "postgresql://localhost/sports_paradise",
      JWT_SIGNING_KEY: testSigningKey,
      WEB_ORIGIN: "https://sports.example/",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);

    expect(config.webOrigin).toBe("https://sports.example");
    expect(config.secureCookies).toBe(true);
    expect(
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
        JWT_SIGNING_KEY: testSigningKey,
        WEB_ORIGIN: "http://sports.example",
      } as NodeJS.ProcessEnv).secureCookies,
    ).toBe(true);
    expect(() =>
      buildAppConfig({
        DATABASE_URL: "postgresql://localhost/sports_paradise",
        JWT_SIGNING_KEY: testSigningKey,
        WEB_ORIGIN: "https://sports.example/path",
      } as NodeJS.ProcessEnv),
    ).toThrow("WEB_ORIGIN must be a valid HTTP or HTTPS origin.");
  });

  it("uses the Fastify browser origin by default in local development", () => {
    const config = buildAppConfig({
      DATABASE_URL: "postgresql://localhost/sports_paradise",
      JWT_SIGNING_KEY: testSigningKey,
    } as NodeJS.ProcessEnv);

    expect(config.webOrigin).toBe("http://localhost:3000");
  });

  it("returns a healthy readiness state when the database check succeeds", async () => {
    const app = buildApiApp(
      {
        host: "127.0.0.1",
        port: 3000,
        databaseUrl: "postgresql://localhost/sports_paradise",
        environment: "test",
        jwtSigningKey: new TextEncoder().encode(testSigningKey),
        webOrigin: "http://localhost:5173",
        secureCookies: false,
      },
      {
        databaseHealthCheck: async () => {
          return;
        },
        sessionService: testSessionService,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: authenticatedHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      database: "connected",
    });
    await app.close();
  });

  it("keeps health public and protects API and page routes with development middleware", async () => {
    const app = buildApiApp(testConfig({ environment: "development" }), {
      databaseHealthCheck: async () => {
        return;
      },
    });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      const echo = await app.inject({
        method: "POST",
        url: "/api/echo",
        payload: { message: "dev-middleware" },
      });
      const protectedPage = await app.inject({
        method: "GET",
        url: "/dashboard",
        headers: { accept: "text/html" },
      });

      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({ status: "ok" });
      expect(echo.statusCode).toBe(401);
      expect(echo.json()).toEqual({ error: "Authentication required." });
      expect(protectedPage.statusCode).toBe(401);
      expect(protectedPage.headers["content-type"]).toContain("text/html");
    } finally {
      await app.close();
    }
  });

  it("authorizes protected Vite middleware requests before serving content", async () => {
    const app = buildApiApp(
      testConfig({ environment: "development", port: 0 }),
      {
        databaseHealthCheck: async () => {
          return;
        },
        sessionService: {
          authenticate: async (token) =>
            token === "valid-vite-session"
              ? {
                  userId: "11111111-1111-4111-8111-111111111111",
                  jti: "22222222-2222-4222-8222-222222222222",
                  expiresAt: Math.floor(Date.now() / 1000) + 3600,
                }
              : null,
          issue: async () => {
            throw new Error("not implemented");
          },
          revoke: async () => undefined,
        },
      },
    );

    try {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const protectedPage = await fetch(`${baseUrl}/`, {
        headers: { accept: "text/html" },
      });
      expect(protectedPage.status).toBe(401);
      expect(protectedPage.headers.get("cache-control")).toBe("no-store");
      expect(protectedPage.headers.get("content-type")).toContain("text/html");
      expect(await protectedPage.text()).toContain('action="/api/auth/login"');

      for (const path of ["/@vite/client", "/src/App.tsx"]) {
        const unauthenticatedAsset = await fetch(`${baseUrl}${path}`);
        expect(unauthenticatedAsset.status, path).toBe(401);
        expect(await unauthenticatedAsset.json(), path).toEqual({
          error: "Authentication required.",
        });
      }

      const authenticatedAsset = await fetch(`${baseUrl}/@vite/client`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-vite-session`,
        },
      });
      expect(authenticatedAsset.status).toBe(200);
      expect(authenticatedAsset.headers.get("content-type")).toContain(
        "javascript",
      );

      const authenticatedFrontendModule = await fetch(
        `${baseUrl}/src/App.tsx`,
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=valid-vite-session`,
          },
        },
      );
      expect(authenticatedFrontendModule.status).toBe(200);
      expect(authenticatedFrontendModule.headers.get("content-type")).toContain(
        "javascript",
      );
    } finally {
      await app.close();
    }
  });

  it("allows an authenticated browser session to access the readiness contract", async () => {
    const app = buildApiApp(
      {
        host: "127.0.0.1",
        port: 3000,
        databaseUrl: "postgresql://localhost/sports_paradise",
        environment: "test",
        jwtSigningKey: new TextEncoder().encode(testSigningKey),
        webOrigin: "http://localhost:5173",
        secureCookies: false,
      },
      {
        databaseHealthCheck: async () => {
          return;
        },
        sessionService: {
          authenticate: async (token) => {
            if (token !== "valid-session-token") {
              return null;
            }
            return {
              userId: "11111111-1111-4111-8111-111111111111",
              jti: "22222222-2222-4222-8222-222222222222",
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            };
          },
          issue: async () => {
            throw new Error("not implemented");
          },
          revoke: async () => undefined,
        },
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=valid-session-token`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      database: "connected",
    });
    await app.close();
  });

  it("serves public login and signup pages directly as standalone HTML", async () => {
    const app = buildApiApp(testConfig());

    const loginResponse = await app.inject({
      method: "GET",
      url: "/login",
    });
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.headers["content-type"]).toContain("text/html");
    expect(loginResponse.body).toContain('action="/api/auth/login"');
    expect(loginResponse.body).toMatch(/name="email" type="email" required/);
    expect(loginResponse.body).toMatch(
      /name="password" type="password" required/,
    );

    const signupResponse = await app.inject({
      method: "GET",
      url: "/signup",
    });
    expect(signupResponse.statusCode).toBe(200);
    expect(signupResponse.headers["content-type"]).toContain("text/html");
    expect(signupResponse.body).toContain('action="/api/auth/signup"');
    expect(signupResponse.body).toMatch(/name="firstName"[^>]*required/);
    expect(signupResponse.body).toMatch(/name="lastName"[^>]*required/);
    expect(signupResponse.body).toMatch(
      /name="password" type="password" required minlength="8"/,
    );
    await app.close();
  });

  it("supports native form submissions and renders authentication outcomes", async () => {
    const inactiveAccountId = "33333333-3333-4333-8333-333333333333";
    const createdAccountId = "11111111-1111-4111-8111-111111111111";
    const accounts = new Map<string, AccountCredentials>([
      [
        "inactive@example.com",
        {
          id: inactiveAccountId,
          email: "inactive@example.com",
          firstName: "Inactive",
          lastName: "User",
          passwordHash: "hashed:correct-password",
          status: "deactivated",
          role: "user",
        },
      ],
    ]);
    let hashCalls = 0;
    let createCalls = 0;
    let sessionIssueCalls = 0;
    const app = buildApiApp(testConfig(), {
      accountRepository: {
        createAccount: async (account) => {
          createCalls += 1;
          if (accounts.has(account.email)) {
            return null;
          }
          const created = {
            id: createdAccountId,
            ...account,
            status: "active" as const,
            role: "user" as const,
          };
          accounts.set(account.email, created);
          return {
            id: created.id,
            email: created.email,
            firstName: created.firstName,
            lastName: created.lastName,
          };
        },
        findAccountById: async (id) =>
          Array.from(accounts.values()).find((account) => account.id === id) ??
          null,
        findCredentialsByEmail: async (email) => accounts.get(email) ?? null,
        deactivateAccount: async () => "not_found",
        isLoginBlocked: async () => false,
        recordFailedLogin: async () => false,
        clearFailedLogins: async () => undefined,
      },
      passwordHasher: {
        hash: async (password) => {
          hashCalls += 1;
          return `hashed:${password}`;
        },
        verify: async (hash, password) => hash === `hashed:${password}`,
      },
      sessionService: {
        authenticate: async (token) =>
          token === "browser-session"
            ? {
                userId: createdAccountId,
                jti: "22222222-2222-4222-8222-222222222222",
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
              }
            : null,
        issue: async (userId) => {
          sessionIssueCalls += 1;
          return {
            token: "browser-session",
            session: {
              userId,
              jti: "22222222-2222-4222-8222-222222222222",
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            },
          };
        },
        revoke: async () => undefined,
      },
    });
    const formHeaders = {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
    };
    const submitForm = (url: string, fields: Record<string, string>) =>
      app.inject({
        method: "POST",
        url,
        headers: formHeaders,
        payload: new URLSearchParams(fields).toString(),
      });

    try {
      const missingFields = await submitForm("/api/auth/signup", {
        email: "",
        password: "",
      });
      expect(missingFields.statusCode).toBe(400);
      expect(missingFields.headers["content-type"]).toContain("text/html");
      expect(missingFields.body).toContain('role="alert"');
      expect(missingFields.body).toContain("required fields");
      expect(hashCalls).toBe(0);
      expect(createCalls).toBe(0);

      const signupFields = {
        firstName: "Browser",
        lastName: "User",
        email: "browser@example.com",
        password: "correct-password",
      };
      const signup = await submitForm("/api/auth/signup", signupFields);
      expect(signup.statusCode).toBe(201);
      expect(signup.headers["content-type"]).toContain("text/html");
      expect(signup.body).toContain("Your account was created.");
      expect(signup.body).toContain('href="/login"');

      const duplicateSignup = await submitForm(
        "/api/auth/signup",
        signupFields,
      );
      expect(duplicateSignup.statusCode).toBe(409);
      expect(duplicateSignup.body).toContain(
        "An account with that email address already exists.",
      );

      const invalidLogin = await submitForm("/api/auth/login", {
        email: "missing@example.com",
        password: "incorrect-password",
      });
      expect(invalidLogin.statusCode).toBe(401);
      expect(invalidLogin.body).toContain("Invalid email or password.");

      const deactivatedLogin = await submitForm("/api/auth/login", {
        email: "inactive@example.com",
        password: "correct-password",
      });
      expect(deactivatedLogin.statusCode).toBe(403);
      expect(deactivatedLogin.body).toContain(
        "Your account has been deactivated.",
      );

      const login = await submitForm("/api/auth/login", {
        email: "browser@example.com",
        password: "correct-password",
      });
      expect(login.statusCode).toBe(303);
      expect(login.headers.location).toBe("/");
      expect(login.headers["set-cookie"]).toContain(
        `${SESSION_COOKIE_NAME}=browser-session`,
      );
      expect(login.headers["set-cookie"]).toContain("HttpOnly");
      expect(sessionIssueCalls).toBe(1);

      const jsonLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { accept: "application/json" },
        payload: {
          email: "browser@example.com",
          password: "correct-password",
        },
      });
      expect(jsonLogin.statusCode).toBe(200);
      expect(jsonLogin.json().user).toMatchObject({
        email: "browser@example.com",
        firstName: "Browser",
      });
      expect(jsonLogin.headers["set-cookie"]).toContain(
        `${SESSION_COOKIE_NAME}=browser-session`,
      );
      expect(sessionIssueCalls).toBe(2);
    } finally {
      await app.close();
    }
  });

  it("denies unauthenticated access to protected operations and near-matches", async () => {
    const app = buildApiApp(testConfig());
    const protectedRequests = [
      { method: "GET", url: "/ready" },
      { method: "GET", url: "/openapi.json" },
      { method: "POST", url: "/api/echo" },
      { method: "GET", url: "/api/echo" },
      { method: "GET", url: "/api/future-operation" },
      { method: "GET", url: "/healthcheck" },
      { method: "POST", url: "/health" },
      { method: "GET", url: "/login/" },
      { method: "GET", url: "/signup/" },
      { method: "POST", url: "/login" },
      { method: "POST", url: "/signup" },
      { method: "GET", url: "/api/auth/login" },
      { method: "GET", url: "/api/auth/signup" },
      { method: "POST", url: "/api/auth/login/" },
      { method: "POST", url: "/api/auth/signup/" },
      { method: "GET", url: "/assets/index-DoGTyxeA.js" },
      { method: "GET", url: "/auth.js" },
      { method: "GET", url: "/favicon.ico/extra" },
      { method: "GET", url: "/test/session-cookie" },
    ] as const;

    try {
      for (const { method, url } of protectedRequests) {
        const response = await app.inject({ method, url });
        expect(response.statusCode, `${method} ${url}`).toBe(401);
        expect(response.json(), `${method} ${url}`).toEqual({
          error: "Authentication required.",
        });
      }

      const htmlReadinessRequest = await app.inject({
        method: "GET",
        url: "/ready",
        headers: { accept: "text/html" },
      });
      expect(htmlReadinessRequest.statusCode).toBe(401);
      expect(htmlReadinessRequest.json()).toEqual({
        error: "Authentication required.",
      });

      for (const url of [
        "/favicon.ico",
        "/robots.txt",
        "/manifest.webmanifest",
      ]) {
        const publicAsset = await app.inject({ method: "GET", url });
        expect(publicAsset.statusCode, url).toBe(404);
      }
    } finally {
      await app.close();
    }
  });

  it("keeps the auth API public only for its exact POST routes", async () => {
    const app = buildApiApp(testConfig());

    try {
      for (const url of ["/api/auth/login", "/api/auth/signup"]) {
        const response = await app.inject({
          method: "POST",
          url,
          payload: {},
        });
        expect(response.statusCode, `POST ${url}`).toBe(400);
      }
    } finally {
      await app.close();
    }
  });

  it("returns the login document for protected page navigation without redirecting", async () => {
    const app = buildApiApp(testConfig());

    const response = await app.inject({
      method: "GET",
      url: "/dashboard",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers.location).toBeUndefined();
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toContain('action="/api/auth/login"');
    await app.close();
  });

  it("returns the exact JSON 401 payload for protected API routes without redirecting", async () => {
    const app = buildApiApp(testConfig());

    const response = await app.inject({
      method: "GET",
      url: "/api/profile",
      headers: {
        accept: "application/json",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers.location).toBeUndefined();
    expect(response.json()).toEqual({ error: "Authentication required." });
    await app.close();
  });

  it("rejects unauthenticated deactivation attempts and requires admin privileges", async () => {
    const accounts = new Map<string, AccountRecord>([
      [
        "11111111-1111-4111-8111-111111111111",
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "admin@example.test",
          firstName: "Admin",
          lastName: "User",
          status: "active",
          role: "admin",
        },
      ],
      [
        "33333333-3333-4333-8333-333333333333",
        {
          id: "33333333-3333-4333-8333-333333333333",
          email: "member@example.test",
          firstName: "Member",
          lastName: "User",
          status: "active",
          role: "user",
        },
      ],
    ]);

    const app = buildApiApp(testConfig(), {
      databaseHealthCheck: async () => undefined,
      accountRepository: {
        createAccount: async () => null,
        findAccountById: async (id: string) => accounts.get(id) ?? null,
        findCredentialsByEmail: async () => null,
        deactivateAccount: async (id: string) => {
          const account = accounts.get(id);
          if (!account) return "not_found";
          if (account.status === "deactivated") return "already_deactivated";
          account.status = "deactivated";
          return "deactivated";
        },
        isLoginBlocked: async () => false,
        recordFailedLogin: async () => false,
        clearFailedLogins: async () => undefined,
      },
      sessionService: {
        authenticate: async (token) => {
          if (token === "admin-session") {
            return {
              userId: "11111111-1111-4111-8111-111111111111",
              jti: "22222222-2222-4222-8222-222222222222",
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            };
          }
          if (token === "member-session") {
            return {
              userId: "33333333-3333-4333-8333-333333333333",
              jti: "44444444-4444-4444-8444-444444444444",
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            };
          }
          return null;
        },
        issue: async () => {
          throw new Error("not implemented");
        },
        revoke: async () => undefined,
      },
    });

    const anonymous = await app.inject({
      method: "POST",
      url: "/api/admin/users/33333333-3333-4333-8333-333333333333/deactivate",
    });
    expect(anonymous.statusCode).toBe(401);

    const member = await app.inject({
      method: "POST",
      url: "/api/admin/users/33333333-3333-4333-8333-333333333333/deactivate",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=member-session`,
      },
    });
    expect(member.statusCode).toBe(403);
    expect(member.json()).toEqual({ error: "Forbidden." });

    const admin = await app.inject({
      method: "POST",
      url: "/api/admin/users/33333333-3333-4333-8333-333333333333/deactivate",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session`,
      },
    });
    expect(admin.statusCode).toBe(200);
    expect(admin.json()).toMatchObject({
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        status: "deactivated",
      },
    });

    await app.close();
  });

  it("returns a non-ready status when the database dependency fails", async () => {
    const app = buildApiApp(
      {
        host: "127.0.0.1",
        port: 3000,
        databaseUrl: "postgresql://user:pass@127.0.0.1:5432/sports_paradise",
        environment: "test",
        jwtSigningKey: new TextEncoder().encode(testSigningKey),
        webOrigin: "http://localhost:5173",
        secureCookies: false,
      },
      {
        databaseHealthCheck: async () => {
          throw new Error(
            "Database connectivity check failed; verify DATABASE_URL and that PostgreSQL is running.",
          );
        },
        sessionService: testSessionService,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: authenticatedHeaders,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      database: "unavailable",
    });
    expect(response.json().error).toContain(
      "Database connectivity check failed",
    );
  });

  it("does not expose database credentials in dependency errors", async () => {
    const secret = "synthetic-password-sentinel";
    const app = buildApiApp(
      {
        host: "127.0.0.1",
        port: 3000,
        databaseUrl:
          "postgresql://app:synthetic-password-sentinel@localhost/db",
        environment: "test",
        jwtSigningKey: new TextEncoder().encode(testSigningKey),
        webOrigin: "http://localhost:5173",
        secureCookies: false,
      },
      {
        databaseHealthCheck: async () => {
          throw new Error(
            `Connection failed for postgresql://app:${secret}@localhost/db`,
          );
        },
        sessionService: testSessionService,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: authenticatedHeaders,
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain(secret);
    expect(response.body).toContain("[REDACTED]");
    await app.close();
  });

  it("redacts malformed PostgreSQL URLs without exposing credentials", () => {
    const malformed =
      "postgresql://user:super-secret@localhost/db?sslmode=disable";
    const redacted = redactConnectionString(malformed);

    expect(redacted).not.toContain("super-secret");
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).toContain(
      "postgresql://[REDACTED]:[REDACTED]@localhost/db?sslmode=disable",
    );
  });

  it("allows the local frontend origin to read the authenticated readiness contract", async () => {
    const app = buildApiApp(testConfig(), {
      databaseHealthCheck: async () => undefined,
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: {
        origin: "http://localhost:5173",
        ...authenticatedHeaders,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers.vary).toContain("Origin");
    await app.close();
  });

  it("does not allow other browser origins", async () => {
    const app = buildApiApp({
      host: "127.0.0.1",
      port: 3000,
      databaseUrl: "postgresql://localhost/sports_paradise",
      environment: "test",
      jwtSigningKey: new TextEncoder().encode(testSigningKey),
      webOrigin: "http://localhost:5173",
      secureCookies: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: {
        origin: "https://untrusted.example",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("rejects invalid echo payloads with a validation error", async () => {
    const app = buildApiApp({
      host: "127.0.0.1",
      port: 3000,
      databaseUrl: "postgresql://user:pass@127.0.0.1:5432/sports_paradise",
      environment: "test",
      jwtSigningKey: new TextEncoder().encode(testSigningKey),
      webOrigin: "http://localhost:5173",
      secureCookies: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/echo",
      headers: authenticatedHeaders,
      payload: {
        notAMessage: "invalid",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("exposes the OpenAPI contract for the foundation endpoints", async () => {
    const app = buildApiApp({
      host: "127.0.0.1",
      port: 3000,
      databaseUrl: "postgresql://user:pass@127.0.0.1:5432/sports_paradise",
      environment: "test",
      jwtSigningKey: new TextEncoder().encode(testSigningKey),
      webOrigin: "http://localhost:5173",
      secureCookies: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
      headers: authenticatedHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.0.3",
      info: {
        title: "Sports_Paradise API",
      },
    });
    expect(response.json().paths).toHaveProperty("/ready");
    for (const path of ["/api/auth/signup", "/api/auth/login"]) {
      expect(
        response.json().paths[path].post.requestBody.content,
      ).toHaveProperty("application/x-www-form-urlencoded");
      expect(
        response.json().paths[path].post.requestBody.content,
      ).toHaveProperty("application/json");
    }

    const echoSchema =
      response.json().paths["/api/echo"].post.requestBody.content[
        "application/json"
      ].schema;

    expect(echoSchema).toMatchObject({
      type: "object",
      required: ["message"],
      additionalProperties: false,
      properties: {
        message: {
          type: "string",
          minLength: 1,
          maxLength: 200,
        },
      },
    });
  });

  it("rejects extra fields in echo requests as described by OpenAPI", async () => {
    const app = buildApiApp(testConfig());

    const response = await app.inject({
      method: "POST",
      url: "/api/echo",
      headers: authenticatedHeaders,
      payload: {
        message: "valid",
        extra: "not allowed by the contract",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});
