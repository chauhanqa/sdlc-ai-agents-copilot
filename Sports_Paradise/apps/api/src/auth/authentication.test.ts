import { describe, expect, it } from "vitest";
import { buildApiApp } from "../app.js";
import type { AppConfig } from "../config.js";
import type {
  AccountCredentials,
  AccountRepository,
  NewAccount,
  PublicAccount,
} from "./account-repository.js";
import type { PasswordHasher } from "./passwords.js";
import type { AuthenticatedSession, SessionService } from "./sessions.js";
import { SESSION_COOKIE_NAME } from "./sessions.js";

const signingKey = new TextEncoder().encode(
  "test-only-signing-key-with-at-least-32-bytes",
);
const testAccountId = "fe809e84-3bfe-4c6b-a138-121524243454";

class MemoryAccountRepository implements AccountRepository {
  readonly users = new Map<string, AccountCredentials>();
  readonly failedAttempts = new Map<string, number>();
  readonly blocked = new Set<string>();

  async createAccount(account: NewAccount): Promise<PublicAccount | null> {
    if (this.users.has(account.email)) {
      return null;
    }

    const created: AccountCredentials = {
      id: testAccountId,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      passwordHash: account.passwordHash,
      status: "active",
      role: "user",
    };
    this.users.set(account.email, created);
    return {
      id: created.id,
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
    };
  }

  async findAccountById(id: string): Promise<AccountCredentials | null> {
    for (const record of this.users.values()) {
      if (record.id === id) {
        return record;
      }
    }
    return null;
  }

  async findCredentialsByEmail(
    email: string,
  ): Promise<AccountCredentials | null> {
    return this.users.get(email) ?? null;
  }

  async deactivateAccount(
    id: string,
  ): Promise<"deactivated" | "already_deactivated" | "not_found"> {
    for (const [email, record] of this.users.entries()) {
      if (record.id !== id) continue;
      if (record.status === "deactivated") {
        return "already_deactivated";
      }
      this.users.set(email, { ...record, status: "deactivated" });
      return "deactivated";
    }
    return "not_found";
  }

  async isLoginBlocked(loginKeyHash: string): Promise<boolean> {
    return this.blocked.has(loginKeyHash);
  }

  async recordFailedLogin(loginKeyHash: string): Promise<boolean> {
    const attempts = (this.failedAttempts.get(loginKeyHash) ?? 0) + 1;
    this.failedAttempts.set(loginKeyHash, attempts);
    if (attempts >= 5) {
      this.blocked.add(loginKeyHash);
      return true;
    }
    return false;
  }

  async clearFailedLogins(loginKeyHash: string): Promise<void> {
    this.failedAttempts.delete(loginKeyHash);
    this.blocked.delete(loginKeyHash);
  }
}

class TestPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test-hash:${password}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return passwordHash === `test-hash:${password}`;
  }
}

class TestSessionService implements SessionService {
  issues: string[] = [];

  async issue(userId: string): Promise<{
    token: string;
    session: AuthenticatedSession;
  }> {
    this.issues.push(userId);
    return {
      token: "test.jwt.token",
      session: { userId, jti: testAccountId, expiresAt: 1_800_000_000 },
    };
  }

  async authenticate(): Promise<AuthenticatedSession | null> {
    return null;
  }

  async revoke(): Promise<void> {}
}

function testConfig(): AppConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    databaseUrl: "postgresql://localhost/sports_paradise",
    environment: "test",
    jwtSigningKey: signingKey,
    webOrigin: "http://localhost:5173",
    secureCookies: false,
  };
}

function buildTestApp(repository = new MemoryAccountRepository()) {
  const sessions = new TestSessionService();
  const app = buildApiApp(testConfig(), {
    accountRepository: repository,
    passwordHasher: new TestPasswordHasher(),
    sessionService: sessions,
  });
  return { app, repository, sessions };
}

const validSignup = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ADA@example.test",
  password: "correct horse battery",
};

describe("signup API", () => {
  it("creates a normalized active account without returning the password hash", async () => {
    const { app, repository, sessions } = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: validSignup,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      user: {
        id: testAccountId,
        email: "ada@example.test",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    });
    const stored = repository.users.get("ada@example.test");
    expect(stored?.status).toBe("active");
    expect(stored?.passwordHash).not.toBe(validSignup.password);
    expect(stored?.passwordHash).toContain("test-hash:");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain(validSignup.password);
    expect(sessions.issues).toHaveLength(0);
    await app.close();
  });

  it("returns friendly duplicate-email errors after normalization", async () => {
    const { app } = buildTestApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: validSignup,
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { ...validSignup, email: " ada@EXAMPLE.test " },
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toContain("already exists");
    await app.close();
  });

  it("rejects missing, short-password, and privilege-assignment signup input", async () => {
    const { app } = buildTestApp();
    const missing = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { firstName: "Ada" },
    });
    const shortPassword = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { ...validSignup, password: "1234567" },
    });
    const privilegeEscalation = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { ...validSignup, role: "admin" },
    });

    expect(missing.statusCode).toBe(400);
    expect(shortPassword.statusCode).toBe(400);
    expect(privilegeEscalation.statusCode).toBe(400);
    await app.close();
  });
});

describe("login API", () => {
  it("issues an HttpOnly session cookie only after valid credentials", async () => {
    const { app, repository, sessions } = buildTestApp();
    await repository.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "test-hash:correct horse battery",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: " ADA@EXAMPLE.TEST ",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: testAccountId,
        email: "ada@example.test",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    });
    expect(response.headers["set-cookie"]).toContain(
      `${SESSION_COOKIE_NAME}=test.jwt.token`,
    );
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(sessions.issues).toEqual([testAccountId]);
    await app.close();
  });

  it("uses identical invalid-credential responses for unknown users and wrong passwords", async () => {
    const { app, repository, sessions } = buildTestApp();
    await repository.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "test-hash:correct horse battery",
    });

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@example.test", password: "wrong password" },
    });
    const unknownUser = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "unknown@example.test", password: "wrong password" },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.statusCode).toBe(wrongPassword.statusCode);
    expect(unknownUser.body).toBe(wrongPassword.body);
    expect(wrongPassword.json()).toEqual({
      error: "Invalid email or password.",
    });
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
    expect(unknownUser.headers["set-cookie"]).toBeUndefined();
    expect(sessions.issues).toHaveLength(0);
    await app.close();
  });

  it("returns the specified message for valid deactivated-account credentials", async () => {
    const { app, repository, sessions } = buildTestApp();
    const account = await repository.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "test-hash:correct horse battery",
    });
    const stored = repository.users.get(account!.email)!;
    repository.users.set(account!.email, { ...stored, status: "deactivated" });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "ada@example.test",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe(
      "Your account has been deactivated. Please contact support.",
    );
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(sessions.issues).toHaveLength(0);
    await app.close();
  });

  it("throttles on the fifth failure and clears the counter after a successful login", async () => {
    const { app, repository } = buildTestApp();
    await repository.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "test-hash:correct horse battery",
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "ada@example.test", password: "wrong password" },
      });
      expect(response.statusCode).toBe(attempt === 4 ? 429 : 401);
    }
    const [keyHash] = repository.blocked;
    expect(keyHash).toBeDefined();
    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "ada@example.test",
        password: "correct horse battery",
      },
    });
    expect(blocked.statusCode).toBe(429);
    repository.blocked.delete(keyHash!);
    repository.failedAttempts.delete(keyHash!);

    const recovered = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "ada@example.test",
        password: "correct horse battery",
      },
    });
    expect(recovered.statusCode).toBe(200);
    expect(repository.failedAttempts.has(keyHash!)).toBe(false);
    await app.close();
  });

  it("accepts short wrong passwords as credential failures rather than signup-policy errors", async () => {
    const { app, repository } = buildTestApp();
    await repository.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "test-hash:correct horse battery",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@example.test", password: "x" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("Invalid email or password.");
    await app.close();
  });
});
