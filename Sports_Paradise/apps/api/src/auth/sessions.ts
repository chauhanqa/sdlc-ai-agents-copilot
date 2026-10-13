import { randomUUID } from "node:crypto";
import { errors, SignJWT, jwtVerify } from "jose";
import type { SessionRepository } from "./session-repository.js";

export const SESSION_COOKIE_NAME = "sports_paradise_session";
export const SESSION_LIFETIME_SECONDS = 24 * 60 * 60;

const JWT_ISSUER = "sports-paradise-api";
const JWT_AUDIENCE = "sports-paradise-web";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthenticatedSession {
  userId: string;
  jti: string;
  expiresAt: number;
}

export interface SessionService {
  issue(
    userId: string,
  ): Promise<{ token: string; session: AuthenticatedSession }>;
  authenticate(token: string | undefined): Promise<AuthenticatedSession | null>;
  revoke(session: AuthenticatedSession): Promise<void>;
}

export class InactiveAccountSessionError extends Error {
  constructor() {
    super("Cannot create a session for an inactive account.");
    this.name = "InactiveAccountSessionError";
  }
}

export function createSessionService(
  repository: SessionRepository,
  signingKey: Uint8Array,
  clock: () => Date = () => new Date(),
): SessionService {
  return {
    async issue(userId) {
      if (!UUID_PATTERN.test(userId)) {
        throw new Error("Cannot create a session for an invalid account.");
      }

      const issuedAt = Math.floor(clock().getTime() / 1000);
      const expiresAt = issuedAt + SESSION_LIFETIME_SECONDS;
      const jti = randomUUID();
      const inserted = await repository.createActiveSession({
        jti,
        userId,
        issuedAt: new Date(issuedAt * 1000),
        expiresAt: new Date(expiresAt * 1000),
      });

      if (!inserted) {
        throw new InactiveAccountSessionError();
      }

      const token = await new SignJWT({ jti })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setSubject(userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(signingKey);

      return {
        token,
        session: { userId, jti, expiresAt },
      };
    },

    async authenticate(token) {
      if (
        typeof token !== "string" ||
        token.length === 0 ||
        token.length > 4096
      ) {
        return null;
      }

      let payload;
      try {
        ({ payload } = await jwtVerify(token, signingKey, {
          algorithms: ["HS256"],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          requiredClaims: ["sub", "jti", "iat", "exp"],
          currentDate: clock(),
        }));
      } catch (error) {
        if (error instanceof errors.JOSEError) {
          return null;
        }
        throw error;
      }

      if (
        typeof payload.sub !== "string" ||
        !UUID_PATTERN.test(payload.sub) ||
        typeof payload.jti !== "string" ||
        !UUID_PATTERN.test(payload.jti) ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number" ||
        payload.iat > Math.floor(clock().getTime() / 1000) ||
        payload.exp - payload.iat !== SESSION_LIFETIME_SECONDS
      ) {
        return null;
      }

      const active = await repository.isActiveSession(
        payload.jti,
        payload.sub,
        payload.exp,
      );
      if (!active) {
        return null;
      }

      return { userId: payload.sub, jti: payload.jti, expiresAt: payload.exp };
    },

    async revoke(session) {
      await repository.revokeSession(session.jti, session.userId);
    },
  };
}
