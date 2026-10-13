import type { Pool } from "pg";

export type AccountStatus = "active" | "deactivated";

export interface PublicAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AccountCredentials extends PublicAccount {
  passwordHash: string;
  status: AccountStatus;
}

export interface NewAccount {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export interface AccountRepository {
  createAccount(account: NewAccount): Promise<PublicAccount | null>;
  findCredentialsByEmail(email: string): Promise<AccountCredentials | null>;
  isLoginBlocked(loginKeyHash: string): Promise<boolean>;
  recordFailedLogin(loginKeyHash: string): Promise<boolean>;
  clearFailedLogins(loginKeyHash: string): Promise<void>;
}

interface PublicAccountRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AccountRow extends PublicAccountRow {
  password_hash: string;
  account_status: AccountStatus;
}

function toPublicAccount(row: PublicAccountRow): PublicAccount {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

export function createPostgresAccountRepository(pool: Pool): AccountRepository {
  return {
    async createAccount(account) {
      try {
        const result = await pool.query<PublicAccountRow>(
          `INSERT INTO users (email, first_name, last_name, password_hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id, email, first_name, last_name`,
          [
            account.email,
            account.firstName,
            account.lastName,
            account.passwordHash,
          ],
        );

        return toPublicAccount(result.rows[0]);
      } catch (error) {
        if (
          error !== null &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "users_email_unique"
        ) {
          return null;
        }
        throw error;
      }
    },

    async findCredentialsByEmail(email) {
      const result = await pool.query<AccountRow>(
        `SELECT id, email, first_name, last_name, password_hash, account_status
         FROM users
         WHERE email = $1`,
        [email],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        ...toPublicAccount(row),
        passwordHash: row.password_hash,
        status: row.account_status,
      };
    },

    async isLoginBlocked(loginKeyHash) {
      const result = await pool.query<{ blocked: boolean }>(
        `WITH expired_state AS (
           DELETE FROM login_throttle_state
           WHERE login_key_hash = $1
             AND (
               (cooldown_until IS NOT NULL AND cooldown_until <= NOW())
               OR (
                 cooldown_until IS NULL
                 AND window_started_at <= NOW() - INTERVAL '5 minutes'
               )
             )
           RETURNING login_key_hash
         )
         SELECT EXISTS (
           SELECT 1
           FROM login_throttle_state
           WHERE login_key_hash = $1
             AND cooldown_until > NOW()
         ) AS blocked`,
        [loginKeyHash],
      );
      return result.rows[0].blocked;
    },

    async recordFailedLogin(loginKeyHash) {
      const result = await pool.query<{ blocked: boolean }>(
        `INSERT INTO login_throttle_state (
           login_key_hash,
           failed_attempts,
           window_started_at
         )
         VALUES ($1, 1, NOW())
         ON CONFLICT (login_key_hash) DO UPDATE
         SET failed_attempts = CASE
               WHEN (
                 login_throttle_state.cooldown_until IS NOT NULL
                 AND login_throttle_state.cooldown_until <= NOW()
               ) OR login_throttle_state.window_started_at
                 <= NOW() - INTERVAL '5 minutes'
                 THEN 1
               ELSE LEAST(login_throttle_state.failed_attempts + 1, 5)
             END,
             window_started_at = CASE
               WHEN (
                 login_throttle_state.cooldown_until IS NOT NULL
                 AND login_throttle_state.cooldown_until <= NOW()
               ) OR login_throttle_state.window_started_at
                 <= NOW() - INTERVAL '5 minutes'
                 THEN NOW()
               ELSE login_throttle_state.window_started_at
             END,
             cooldown_until = CASE
               WHEN login_throttle_state.cooldown_until > NOW()
                 THEN login_throttle_state.cooldown_until
               WHEN (
                 login_throttle_state.cooldown_until IS NOT NULL
                 AND login_throttle_state.cooldown_until <= NOW()
               ) OR login_throttle_state.window_started_at
                 <= NOW() - INTERVAL '5 minutes'
                 THEN NULL
               WHEN login_throttle_state.failed_attempts >= 4
                 THEN NOW() + INTERVAL '5 minutes'
               ELSE NULL
             END,
             updated_at = NOW()
         RETURNING COALESCE(cooldown_until > NOW(), FALSE) AS blocked`,
        [loginKeyHash],
      );
      return result.rows[0].blocked;
    },

    async clearFailedLogins(loginKeyHash) {
      await pool.query(
        "DELETE FROM login_throttle_state WHERE login_key_hash = $1",
        [loginKeyHash],
      );
    },
  };
}
