import type { FastifyReply } from "fastify";
import { SESSION_COOKIE_NAME } from "./sessions.js";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60,
};

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  secure: boolean,
): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    secure,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    ...cookieOptions,
    secure,
  });
}
