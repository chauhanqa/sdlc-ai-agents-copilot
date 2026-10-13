import type { Pool } from "pg";

export interface NewSession {
  jti: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface SessionRepository {
  createActiveSession(session: NewSession): Promise<boolean>;
  isActiveSession(
    jti: string,
    userId: string,
    expiresAtSeconds: number,
  ): Promise<boolean>;
  revokeSession(jti: string, userId: string): Promise<void>;
}

export function createPostgresSessionRepository(pool: Pool): SessionRepository {
  return {
    async createActiveSession({ jti, userId, issuedAt, expiresAt }) {
      const result = await pool.query(
        `INSERT INTO auth_sessions (jti, user_id, issued_at, expires_at)
         SELECT $1, id, $3, $4
         FROM users
         WHERE id = $2 AND account_status = 'active'
         RETURNING jti`,
        [jti, userId, issuedAt, expiresAt],
      );

      return result.rowCount === 1;
    },

    async isActiveSession(jti, userId, expiresAtSeconds) {
      const result = await pool.query(
        `SELECT 1
         FROM auth_sessions AS sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.jti = $1
           AND sessions.user_id = $2
           AND sessions.expires_at = to_timestamp($3)
           AND sessions.expires_at > NOW()
           AND sessions.revoked_at IS NULL
           AND users.account_status = 'active'`,
        [jti, userId, expiresAtSeconds],
      );

      return result.rowCount === 1;
    },

    async revokeSession(jti, userId) {
      await pool.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [jti, userId],
      );
    },
  };
}
