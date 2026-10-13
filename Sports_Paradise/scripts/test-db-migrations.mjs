import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cleanupTargets = [];

function redactSecrets(value, env) {
  let redactedValue = value;

  for (const [name, secret] of Object.entries(env)) {
    if (
      typeof secret === "string" &&
      secret.length > 0 &&
      /(PASSWORD|SECRET|TOKEN|CREDENTIAL)/i.test(name)
    ) {
      redactedValue = redactedValue.replaceAll(secret, "[REDACTED]");
    }
  }

  return redactedValue;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
}

function runCompose(projectName, args, env) {
  const result = run(
    "docker",
    ["compose", "--project-name", projectName, ...args],
    { env: { ...process.env, ...env } },
  );

  if (result.error || result.status !== 0) {
    const details = [
      result.error ? `Process error: ${result.error.message}` : null,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : null,
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(
      [
        `Docker Compose ${args[0]} for isolated project ${projectName} failed.`,
        redactSecrets(details || "No process output.", env),
      ].join("\n"),
    );
  }

  return result.stdout.trim();
}

function runPsql(projectName, env, sql) {
  return runCompose(
    projectName,
    [
      "exec",
      "-T",
      "database",
      "psql",
      "--set=ON_ERROR_STOP=1",
      "--username",
      env.POSTGRES_USER,
      "--dbname",
      env.POSTGRES_DB,
      "--tuples-only",
      "--no-align",
      "--command",
      sql,
    ],
    env,
  );
}

function runMigration(direction, connectionString, env) {
  const migrationCli = path.join(
    projectRoot,
    "node_modules",
    "node-pg-migrate",
    "bin",
    "node-pg-migrate.js",
  );
  const result = run(
    process.execPath,
    [
      migrationCli,
      direction,
      "--migrations-dir",
      "apps/api/migrations",
      "--migration-file-language",
      "ts",
    ],
    {
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: connectionString,
      },
    },
  );

  if (result.error || result.status !== 0) {
    const details = [
      result.error ? `Process error: ${result.error.message}` : null,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : null,
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(
      [
        `node-pg-migrate ${direction} failed.`,
        redactSecrets(details || "No process output.", env),
      ].join("\n"),
    );
  }

  return result.stdout.trim();
}

function runSessionRepositoryChecks(connectionString, env) {
  const result = run(
    process.execPath,
    ["--import", "tsx", "scripts/test-auth-session-repository.mjs"],
    {
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: connectionString,
      },
    },
  );

  if (result.error || result.status !== 0) {
    const details = [
      result.error ? `Process error: ${result.error.message}` : null,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : null,
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(
      [
        "Auth session repository integration checks failed.",
        redactSecrets(details || "No process output.", env),
      ].join("\n"),
    );
  }

  return result.stdout.trim();
}

function runAuthenticationRepositoryChecks(connectionString, env) {
  const result = run(
    process.execPath,
    ["--import", "tsx", "scripts/test-authentication-repository.mjs"],
    {
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: connectionString,
      },
    },
  );

  if (result.error || result.status !== 0) {
    const details = [
      result.error ? `Process error: ${result.error.message}` : null,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : null,
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(
      [
        "Authentication repository integration checks failed.",
        redactSecrets(details || "No process output.", env),
      ].join("\n"),
    );
  }

  return result.stdout.trim();
}

async function findAvailablePort() {
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine an available local TCP port.");
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  return address.port;
}

function createProjectName() {
  return `sports-paradise-db-migrations-${process.pid}-${Date.now()}`;
}

async function main() {
  const projectName = createProjectName();
  const env = {
    POSTGRES_DB: "sports_paradise_migration_test",
    POSTGRES_USER: "migration_admin",
    POSTGRES_PASSWORD: `synthetic-bootstrap-${process.pid}-${Date.now()}`,
    POSTGRES_APP_USER: "migration_app",
    POSTGRES_APP_PASSWORD: `synthetic-app-${process.pid}-${Date.now()}`,
    POSTGRES_PORT: String(await findAvailablePort()),
  };
  cleanupTargets.push({ projectName, env });

  let executionError;
  let sessionRepositoryEvidence = "";
  let authenticationRepositoryEvidence = "";

  try {
    runCompose(projectName, ["up", "--detach", "--wait", "database"], env);

    runPsql(
      projectName,
      env,
      "CREATE TABLE foundation_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL); INSERT INTO foundation_probe VALUES (1, 'preserved');",
    );

    const databaseUrl = new URL("postgresql://localhost");
    databaseUrl.username = env.POSTGRES_APP_USER;
    databaseUrl.password = env.POSTGRES_APP_PASSWORD;
    databaseUrl.hostname = "127.0.0.1";
    databaseUrl.port = env.POSTGRES_PORT;
    databaseUrl.pathname = `/${env.POSTGRES_DB}`;

    runMigration("up", databaseUrl.toString(), env);

    const validationSql = `
      BEGIN;
      DO $$
      DECLARE
        account_id UUID;
        stored_role TEXT;
        stored_status TEXT;
        stored_revoked_at TIMESTAMPTZ;
        session_started_at TIMESTAMPTZ := NOW();
      BEGIN
        IF to_regclass('public.users') IS NULL
          OR to_regclass('public.auth_sessions') IS NULL
          OR to_regclass('public.login_throttle_state') IS NULL THEN
          RAISE EXCEPTION 'Authentication persistence tables are missing.';
        END IF;

        INSERT INTO users (email, first_name, last_name, password_hash)
        VALUES ('ada@example.test', 'Ada', 'Lovelace', '$argon2id$test')
        RETURNING id, account_role, account_status
        INTO account_id, stored_role, stored_status;

        IF stored_role <> 'user' OR stored_status <> 'active' THEN
          RAISE EXCEPTION 'New accounts must default to active non-admin status.';
        END IF;

        BEGIN
          UPDATE users
          SET account_status = 'deactivated'
          WHERE id = account_id;
          RAISE EXCEPTION 'Deactivated account without a timestamp was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;

        UPDATE users
        SET account_status = 'deactivated', deactivated_at = NOW()
        WHERE id = account_id;

        IF NOT EXISTS (
          SELECT 1 FROM users
          WHERE id = account_id
            AND account_status = 'deactivated'
            AND deactivated_at IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Account deactivation state was not persisted.';
        END IF;

        BEGIN
          INSERT INTO users (email, first_name, last_name, password_hash)
          VALUES ('ada@example.test', 'Duplicate', 'User', '$argon2id$test');
          RAISE EXCEPTION 'Duplicate normalized email was accepted.';
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;

        BEGIN
          INSERT INTO users (email, first_name, last_name, password_hash)
          VALUES ('ADA@example.test', 'Upper', 'Case', '$argon2id$test');
          RAISE EXCEPTION 'Non-normalized email was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;

        BEGIN
          INSERT INTO users (email, first_name, last_name, password_hash)
          VALUES ('plain@example.test', 'Plain', 'Password', 'plain-text');
          RAISE EXCEPTION 'Non-Argon2id password value was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;

        UPDATE users
        SET account_status = 'active', deactivated_at = NULL
        WHERE id = account_id;

        INSERT INTO auth_sessions (user_id, issued_at, expires_at)
        VALUES (account_id, session_started_at, session_started_at + INTERVAL '24 hours')
        RETURNING revoked_at INTO stored_revoked_at;

        IF stored_revoked_at IS NOT NULL THEN
          RAISE EXCEPTION 'New sessions must not be revoked.';
        END IF;

        BEGIN
          INSERT INTO auth_sessions (user_id, issued_at, expires_at)
          VALUES (
            account_id,
            session_started_at,
            session_started_at + INTERVAL '24 hours 1 second'
          );
          RAISE EXCEPTION 'Session longer than 24 hours was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;

        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE user_id = account_id;

        IF NOT EXISTS (
          SELECT 1 FROM auth_sessions
          WHERE user_id = account_id AND revoked_at IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Session revocation state was not persisted.';
        END IF;

        INSERT INTO login_throttle_state (login_key_hash, failed_attempts)
        VALUES (repeat('a', 64), 5);

        BEGIN
          INSERT INTO login_throttle_state (login_key_hash, failed_attempts)
          VALUES (repeat('b', 64), 6);
          RAISE EXCEPTION 'Out-of-range login failure count was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;

        BEGIN
          INSERT INTO login_throttle_state (login_key_hash)
          VALUES ('invalid-digest');
          RAISE EXCEPTION 'Invalid login key digest was accepted.';
        EXCEPTION WHEN check_violation THEN
          NULL;
        END;
      END $$;
      ROLLBACK;
    `;
    runPsql(projectName, env, validationSql);
    sessionRepositoryEvidence = runSessionRepositoryChecks(
      databaseUrl.toString(),
      env,
    );
    authenticationRepositoryEvidence = runAuthenticationRepositoryChecks(
      databaseUrl.toString(),
      env,
    );

    const preservedBeforeRollback = runPsql(
      projectName,
      env,
      "SELECT value FROM foundation_probe WHERE id = 1;",
    );
    if (preservedBeforeRollback !== "preserved") {
      throw new Error("Foundation data changed when applying the migration.");
    }

    runMigration("down", databaseUrl.toString(), env);

    const rollbackResult = runPsql(
      projectName,
      env,
      "SELECT to_regclass('public.users') IS NULL AND to_regclass('public.auth_sessions') IS NULL AND to_regclass('public.login_throttle_state') IS NULL;",
    );
    if (rollbackResult !== "t") {
      throw new Error("Migration rollback left authentication tables behind.");
    }

    const preservedAfterRollback = runPsql(
      projectName,
      env,
      "SELECT value FROM foundation_probe WHERE id = 1;",
    );
    if (preservedAfterRollback !== "preserved") {
      throw new Error("Migration rollback changed existing foundation data.");
    }
  } catch (error) {
    executionError = error;
  }

  const cleanupErrors = [];
  for (const { projectName: targetName, env: targetEnv } of cleanupTargets) {
    try {
      runCompose(
        targetName,
        ["down", "--volumes", "--remove-orphans"],
        targetEnv,
      );
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (executionError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [
        executionError,
        new Error(
          `Could not remove isolated database test projects:\n${cleanupErrors.join("\n")}`,
        ),
      ],
      "Database migration checks failed and cleanup was incomplete.",
    );
  }

  if (executionError) {
    throw executionError;
  }

  if (cleanupErrors.length > 0) {
    throw new Error(
      `Could not remove isolated database test projects:\n${cleanupErrors.join("\n")}`,
    );
  }

  console.log(
    [
      "Database migration checks passed: additive schema, normalized unique accounts, Argon2id hash constraint, active non-admin defaults, session expiry/revocation, bounded login throttling, and foundation data preservation through up/down.",
      sessionRepositoryEvidence,
      authenticationRepositoryEvidence,
    ].join("\n"),
  );
}

await main();
