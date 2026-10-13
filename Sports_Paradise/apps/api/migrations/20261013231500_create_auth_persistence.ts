import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      account_role TEXT NOT NULL DEFAULT 'user',
      account_status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deactivated_at TIMESTAMPTZ,
      CONSTRAINT users_email_normalized
        CHECK (email <> '' AND email = LOWER(BTRIM(email))),
      CONSTRAINT users_email_unique UNIQUE (email),
      CONSTRAINT users_first_name_nonempty
        CHECK (first_name <> '' AND first_name = BTRIM(first_name)),
      CONSTRAINT users_last_name_nonempty
        CHECK (last_name <> '' AND last_name = BTRIM(last_name)),
      CONSTRAINT users_password_hash_argon2id
        CHECK (LENGTH(password_hash) <= 512 AND password_hash LIKE '$argon2id$%'),
      CONSTRAINT users_account_role_valid
        CHECK (account_role IN ('user', 'admin')),
      CONSTRAINT users_account_status_valid
        CHECK (account_status IN ('active', 'deactivated')),
      CONSTRAINT users_deactivation_state_consistent
        CHECK (
          (account_status = 'active' AND deactivated_at IS NULL)
          OR (account_status = 'deactivated' AND deactivated_at IS NOT NULL)
        )
    );

    CREATE TABLE auth_sessions (
      jti UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issued_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      CONSTRAINT auth_sessions_expiry_valid
        CHECK (
          expires_at > issued_at
          AND expires_at <= issued_at + INTERVAL '24 hours'
        ),
      CONSTRAINT auth_sessions_revocation_valid
        CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
    );

    CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
    CREATE INDEX auth_sessions_active_expiry_idx
      ON auth_sessions (expires_at)
      WHERE revoked_at IS NULL;

    CREATE TABLE login_throttle_state (
      login_key_hash TEXT PRIMARY KEY,
      failed_attempts SMALLINT NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cooldown_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT login_throttle_key_hash_valid
        CHECK (login_key_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT login_throttle_failed_attempts_bounded
        CHECK (failed_attempts BETWEEN 0 AND 5),
      CONSTRAINT login_throttle_cooldown_state_valid
        CHECK (cooldown_until IS NULL OR failed_attempts = 5)
    );

    CREATE INDEX login_throttle_cooldown_idx
      ON login_throttle_state (cooldown_until)
      WHERE cooldown_until IS NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE login_throttle_state;
    DROP TABLE auth_sessions;
    DROP TABLE users;
  `);
}
