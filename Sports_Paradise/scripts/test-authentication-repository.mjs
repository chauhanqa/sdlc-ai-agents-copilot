import { createHash } from "node:crypto";
import { Pool } from "pg";
import { createPostgresAccountRepository } from "../apps/api/src/auth/account-repository.ts";
import { createAuthenticationService } from "../apps/api/src/auth/authentication.ts";
import { passwordHasher } from "../apps/api/src/auth/passwords.ts";
import { createPostgresSessionRepository } from "../apps/api/src/auth/session-repository.ts";
import { createSessionService } from "../apps/api/src/auth/sessions.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for authentication repository integration tests.",
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const accounts = createPostgresAccountRepository(pool);
const sessions = createSessionService(
  createPostgresSessionRepository(pool),
  new TextEncoder().encode("integration-only-signing-key-with-32-bytes"),
);
const authentication = createAuthenticationService(
  accounts,
  sessions,
  passwordHasher,
);
const unique = `${process.pid}-${Date.now()}`;
const email = `auth-integration-${unique}@example.test`;
const unknownEmail = `auth-unknown-${unique}@example.test`;
const password = "correct horse battery";
const trackedHashes = [email, unknownEmail].map((value) =>
  createHash("sha256").update(value).digest("hex"),
);
let userId;

try {
  const [firstSignup, duplicateSignup] = await Promise.all([
    authentication.signup({
      firstName: " Ada ",
      lastName: " Lovelace ",
      email: email.toUpperCase(),
      password,
    }),
    authentication.signup({
      firstName: "Ada",
      lastName: "Lovelace",
      email,
      password,
    }),
  ]);
  const outcomes = [firstSignup.type, duplicateSignup.type].sort();
  if (outcomes.join(",") !== "created,duplicate") {
    throw new Error(
      "Concurrent signup did not enforce unique normalized email.",
    );
  }

  const storedResult = await pool.query(
    `SELECT id, email, first_name, last_name, password_hash, account_role,
            account_status
     FROM users
     WHERE email = $1`,
    [email],
  );
  if (storedResult.rowCount !== 1) {
    throw new Error("Signup did not create exactly one account.");
  }
  const stored = storedResult.rows[0];
  userId = stored.id;
  if (
    stored.email !== email ||
    stored.first_name !== "Ada" ||
    stored.last_name !== "Lovelace" ||
    stored.account_role !== "user" ||
    stored.account_status !== "active" ||
    !stored.password_hash.startsWith("$argon2id$") ||
    stored.password_hash === password
  ) {
    throw new Error("Signup persisted incorrect account or password state.");
  }

  const wrongPassword = await authentication.login({
    email,
    password: "incorrect password",
  });
  const unknownAccount = await authentication.login({
    email: unknownEmail,
    password: "incorrect password",
  });
  if (
    wrongPassword.type !== "invalid-credentials" ||
    unknownAccount.type !== wrongPassword.type
  ) {
    throw new Error("Unknown and incorrect-password login outcomes differ.");
  }
  await accounts.clearFailedLogins(trackedHashes[0]);

  let lastFailure;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastFailure = await authentication.login({
      email,
      password: "incorrect password",
    });
  }
  if (lastFailure?.type !== "throttled") {
    throw new Error("The fifth failed login did not activate the cooldown.");
  }
  const throttleState = await pool.query(
    `SELECT failed_attempts, cooldown_until, login_key_hash
     FROM login_throttle_state
     WHERE login_key_hash = $1`,
    [trackedHashes[0]],
  );
  if (
    throttleState.rowCount !== 1 ||
    throttleState.rows[0].failed_attempts !== 5 ||
    !throttleState.rows[0].cooldown_until ||
    throttleState.rows[0].login_key_hash === email
  ) {
    throw new Error("Persistent login throttle state was not recorded safely.");
  }
  if (
    (
      await authentication.login({
        email,
        password,
      })
    ).type !== "throttled"
  ) {
    throw new Error("A valid login bypassed an active cooldown.");
  }

  await pool.query(
    `UPDATE login_throttle_state
     SET cooldown_until = NOW() - INTERVAL '1 second'
     WHERE login_key_hash = $1`,
    [trackedHashes[0]],
  );
  const successfulLogin = await authentication.login({ email, password });
  if (successfulLogin.type !== "authenticated") {
    throw new Error("Valid credentials did not authenticate after cooldown.");
  }
  if (!(await sessions.authenticate(successfulLogin.token))) {
    throw new Error("Successful login did not create an active session.");
  }
  const clearedThrottle = await pool.query(
    "SELECT 1 FROM login_throttle_state WHERE login_key_hash = $1",
    [trackedHashes[0]],
  );
  if (clearedThrottle.rowCount !== 0) {
    throw new Error("Successful login did not clear failed-login state.");
  }

  await pool.query(
    `UPDATE users
     SET account_status = 'deactivated', deactivated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
  const deactivatedLogin = await authentication.login({ email, password });
  if (deactivatedLogin.type !== "deactivated") {
    throw new Error(
      "Valid credentials for a deactivated account were accepted.",
    );
  }
  if (await sessions.authenticate(successfulLogin.token)) {
    throw new Error("A deactivated account retained an active session.");
  }

  console.log(
    "Authentication repository integration checks passed: concurrent normalized signup uniqueness, active non-admin defaults, Argon2id-only password persistence, generic invalid credentials, five-failure cooldown/recovery, successful session creation, and deactivated-account rejection.",
  );
} finally {
  if (userId) {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }
  for (const loginKeyHash of trackedHashes) {
    await accounts.clearFailedLogins(loginKeyHash);
  }
  await pool.end();
}
