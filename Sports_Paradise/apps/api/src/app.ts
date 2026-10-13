import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { Pool } from "pg";
import { checkDatabaseConnection, createDatabasePool } from "./db/pool.js";
import { redactConnectionString, type AppConfig } from "./config.js";
import { clearSessionCookie, setSessionCookie } from "./auth/cookies.js";
import {
  AuthInputError,
  createAuthenticationService,
} from "./auth/authentication.js";
import {
  createPostgresAccountRepository,
  type AccountRepository,
} from "./auth/account-repository.js";
import type { PasswordHasher } from "./auth/passwords.js";
import { passwordHasher } from "./auth/passwords.js";
import {
  createPostgresSessionRepository,
  type SessionRepository,
} from "./auth/session-repository.js";
import {
  createSessionService,
  type AuthenticatedSession,
  type SessionService,
  SESSION_COOKIE_NAME,
} from "./auth/sessions.js";

declare module "fastify" {
  interface FastifyRequest {
    authSession: AuthenticatedSession | null;
  }
}

export interface AppDependencies {
  databaseHealthCheck?: (pool: Pool) => Promise<void>;
  accountRepository?: AccountRepository;
  passwordHasher?: PasswordHasher;
  sessionRepository?: SessionRepository;
  sessionService?: SessionService;
}

const emailSchema = {
  type: "string",
  minLength: 3,
  maxLength: 254,
  pattern: "^[\\s]*[^\\s@]+@[^\\s@]+\\.[^\\s@]+[\\s]*$",
} as const;

const signupBodySchema = {
  type: "object",
  required: ["firstName", "lastName", "email", "password"],
  additionalProperties: false,
  properties: {
    firstName: { type: "string", minLength: 1, maxLength: 100 },
    lastName: { type: "string", minLength: 1, maxLength: 100 },
    email: emailSchema,
    password: { type: "string", minLength: 8, maxLength: 1024 },
  },
} as const;

const loginBodySchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: emailSchema,
    password: { type: "string", minLength: 1, maxLength: 1024 },
  },
} as const;

const echoBodySchema = {
  type: "object",
  required: ["message"],
  additionalProperties: false,
  properties: {
    message: {
      type: "string",
      minLength: 1,
      maxLength: 200,
    },
  },
} as const;

const echoResponseSchema = {
  type: "object",
  required: ["message", "echoed"],
  additionalProperties: false,
  properties: {
    message: {
      type: "string",
    },
    echoed: {
      type: "string",
    },
  },
} as const;

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Sports_Paradise API",
    version: "0.1.0",
    description:
      "Foundation API contract for the Sports_Paradise application shell.",
  },
  servers: [{ url: "http://localhost:3000" }],
  paths: {
    "/health": {
      get: {
        summary: "Service health",
        responses: {
          200: {
            description: "The API is running.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "database"],
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                    database: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness check",
        responses: {
          200: {
            description: "The service and database are healthy.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "database"],
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                    database: { type: "string" },
                  },
                },
              },
            },
          },
          503: {
            description:
              "The service is not ready because the database is unavailable.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "database", "error"],
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                    database: { type: "string" },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/echo": {
      post: {
        summary: "Echo a message for validation smoke tests",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                additionalProperties: false,
                properties: {
                  message: { type: "string", minLength: 1, maxLength: 200 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The request was accepted and echoed back.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message", "echoed"],
                  properties: {
                    message: { type: "string" },
                    echoed: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            description: "Request validation failed.",
          },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        summary: "Create an active user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: signupBodySchema,
            },
          },
        },
        responses: {
          201: { description: "The account was created." },
          400: { description: "Signup input is invalid." },
          409: { description: "An account already uses that email address." },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Authenticate with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: loginBodySchema,
            },
          },
        },
        responses: {
          200: { description: "The authenticated session was created." },
          400: { description: "Login input is invalid." },
          401: { description: "The credentials are invalid." },
          403: { description: "The account is deactivated." },
          429: { description: "Login attempts are temporarily throttled." },
        },
      },
    },
  },
} as const;

export function buildApiApp(
  config: AppConfig,
  dependencies: AppDependencies = {},
): FastifyInstance {
  const app = Fastify({
    logger: false,
    ajv: {
      customOptions: {
        allErrors: true,
        removeAdditional: false,
      },
    },
  });

  const databasePool = createDatabasePool(config.databaseUrl);
  const checkDatabase =
    dependencies.databaseHealthCheck ?? checkDatabaseConnection;
  const sessionRepository =
    dependencies.sessionRepository ??
    createPostgresSessionRepository(databasePool);
  const sessionService =
    dependencies.sessionService ??
    createSessionService(sessionRepository, config.jwtSigningKey);
  const accountRepository =
    dependencies.accountRepository ??
    createPostgresAccountRepository(databasePool);
  const authenticationService = createAuthenticationService(
    accountRepository,
    sessionService,
    dependencies.passwordHasher ?? passwordHasher,
  );

  app.register(cookie);
  app.decorateRequest("authSession", null);
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === config.webOrigin) {
      reply.header("access-control-allow-origin", config.webOrigin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "Origin");
    }

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      origin !== undefined &&
      origin !== config.webOrigin
    ) {
      return reply.code(403).send({ error: "Origin not allowed." });
    }
  });

  app.addHook("onClose", async () => {
    await databasePool.end();
  });

  app.setErrorHandler((error, _request, reply) => {
    const typedError = error as Error & {
      statusCode?: number;
      validation?: unknown[];
    };
    const isValidationError = Array.isArray(typedError.validation);
    const responseCode =
      typeof typedError.statusCode === "number" && typedError.statusCode > 0
        ? typedError.statusCode
        : 500;
    const message = redactConnectionString(
      typedError.message || "Internal Server Error",
    );

    reply.code(responseCode).send({
      error: {
        code: isValidationError ? "VALIDATION_ERROR" : "INTERNAL_SERVER_ERROR",
        message,
        ...(isValidationError && {
          details: typedError.validation,
        }),
      },
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "sports-paradise-api",
    database: "unknown",
  }));

  app.post(
    "/api/auth/signup",
    { schema: { body: signupBodySchema } },
    async (request, reply) => {
      try {
        const result = await authenticationService.signup(
          request.body as {
            firstName: string;
            lastName: string;
            email: string;
            password: string;
          },
        );
        if (result.type === "duplicate") {
          return reply.code(409).send({
            error: "An account with that email address already exists.",
          });
        }
        return reply.code(201).send({ user: result.account });
      } catch (error) {
        if (error instanceof AuthInputError) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/auth/login",
    { schema: { body: loginBodySchema } },
    async (request, reply) => {
      try {
        const result = await authenticationService.login(
          request.body as { email: string; password: string },
        );
        if (result.type === "invalid-credentials") {
          return reply.code(401).send({ error: "Invalid email or password." });
        }
        if (result.type === "deactivated") {
          return reply.code(403).send({
            error: "Your account has been deactivated. Please contact support.",
          });
        }
        if (result.type === "throttled") {
          return reply.code(429).send({
            error: "Too many login attempts. Try again later.",
          });
        }

        setSessionCookie(reply, result.token, config.secureCookies);
        return reply.code(200).send({ user: result.account });
      } catch (error) {
        if (error instanceof AuthInputError) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/auth/logout",
    {
      preHandler: async (request, reply) => {
        const session = await sessionService.authenticate(
          request.cookies[SESSION_COOKIE_NAME],
        );
        if (!session) {
          return reply.code(401).send({
            error: "Authentication required.",
          });
        }
        request.authSession = session;
      },
    },
    async (request, reply) => {
      if (!request.authSession) {
        return reply.code(401).send({
          error: "Authentication required.",
        });
      }
      await sessionService.revoke(request.authSession);
      clearSessionCookie(reply, config.secureCookies);
      return reply.code(204).send();
    },
  );

  app.get("/ready", async (_request, reply) => {
    try {
      await checkDatabase(databasePool);

      return reply.code(200).send({
        status: "ready",
        service: "sports-paradise-api",
        database: "connected",
      });
    } catch (error) {
      const message = redactConnectionString(
        error instanceof Error ? error.message : "Database unavailable",
      );

      return reply.code(503).send({
        status: "not_ready",
        service: "sports-paradise-api",
        database: "unavailable",
        error: message,
      });
    }
  });

  app.get("/openapi.json", async () => openApiSpec);

  app.post(
    "/api/echo",
    {
      schema: {
        body: echoBodySchema,
        response: {
          200: echoResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { message } = request.body as { message: string };
      return reply.code(200).send({
        message,
        echoed: message,
      });
    },
  );

  return app;
}
