import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createPostgresSessionRepository } from "../apps/api/src/auth/session-repository.ts";
import { createSessionService } from "../apps/api/src/auth/sessions.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for auth session integration tests.",
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const repository = createPostgresSessionRepository(pool);
const signingKey = new TextEncoder().encode(randomBytes(32).toString("base64"));
const service = createSessionService(repository, signingKey);
let userId;

try {
  const createdUser = await pool.query(
    `INSERT INTO users (email, first_name, last_name, password_hash)
     VALUES ($1, 'Session', 'Integration', '$argon2id$integration-test')
     RETURNING id`,
    [`session-integration-${process.pid}-${Date.now()}@example.test`],
  );
  userId = createdUser.rows[0].id;

  const first = await service.issue(userId);
  const second = await service.issue(userId);

  if (
    !(await service.authenticate(first.token)) ||
    !(await service.authenticate(second.token))
  ) {
    throw new Error(
      "Newly issued sessions were not accepted by the repository.",
    );
  }

  await service.revoke(first.session);
  if (await service.authenticate(first.token)) {
    throw new Error("Revoked session remained valid.");
  }
  if (!(await service.authenticate(second.token))) {
    throw new Error("Revoking one session affected a separate session.");
  }

  await pool.query(
    `UPDATE users
     SET account_status = 'deactivated', deactivated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
  if (await service.authenticate(second.token)) {
    throw new Error("Session for a deactivated account remained valid.");
  }
  await expectInactiveIssue();

  console.log(
    "Auth session repository integration checks passed: active session issuance, persisted lookup, current-session revocation, independent-session preservation, and account deactivation.",
  );
} finally {
  if (userId) {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }
  await pool.end();
}

async function expectInactiveIssue() {
  try {
    await service.issue(userId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Cannot create a session for an inactive account."
    ) {
      return;
    }
    throw error;
  }

  throw new Error("A deactivated account was allowed to create a session.");
}
