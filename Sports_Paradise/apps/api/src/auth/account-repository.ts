import type { Pool } from "pg";

export type AccountStatus = "active" | "deactivated";
export type AccountRole = "user" | "admin";

export interface PublicAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AccountCredentials extends PublicAccount {
  passwordHash: string;
  status: AccountStatus;
  role: AccountRole;
}

export interface AccountRecord extends PublicAccount {
  status: AccountStatus;
  role: AccountRole;
}

export interface NewAccount {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export interface AccountRepository {
  createAccount(account: NewAccount): Promise<PublicAccount | null>;
  findAccountById(id: string): Promise<AccountRecord | null>;
  findCredentialsByEmail(email: string): Promise<AccountCredentials | null>;
  deactivateAccount(
    id: string,
  ): Promise<"deactivated" | "already_deactivated" | "not_found">;
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
  account_role: AccountRole;
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

    async findAccountById(id) {
      const result = await pool.query<AccountRow>(
        `SELECT id, email, first_name, last_name, account_status, account_role
         FROM users
         WHERE id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        ...toPublicAccount(row),
        status: row.account_status,
        role: row.account_role,
      };
    },

    async findCredentialsByEmail(email) {
      const result = await pool.query<AccountRow>(
        `SELECT id, email, first_name, last_name, password_hash, account_status, account_role
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
        role: row.account_role,
      };
    },

    async deactivateAccount(id) {
      const result = await pool.query<{ account_status: AccountStatus }>(
        `WITH updated AS (
           UPDATE users
           SET account_status = 'deactivated',
               deactivated_at = COALESCE(deactivated_at, NOW()),
               updated_at = NOW()
           WHERE id = $1 AND account_status = 'active'
           RETURNING id, account_status
         ),
         invalidated AS (
           UPDATE auth_sessions
           SET revoked_at = COALESCE(revoked_at, NOW())
           WHERE user_id = $1 AND revoked_at IS NULL
           RETURNING 1
         )
         SELECT account_status FROM updated`,
        [id],
      );

      if (result.rowCount === 1) {
        return "deactivated";
      }

      const current = await pool.query<{ account_status: AccountStatus }>(
        `SELECT account_status FROM users WHERE id = $1`,
        [id],
      );
      if (current.rowCount !== 1) {
        return "not_found";
      }
      return current.rows[0].account_status === "deactivated"
        ? "already_deactivated"
        : "not_found";
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
