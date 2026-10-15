import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import middie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import type { Pool } from "pg";
import { createServer as createViteDevServer } from "vite";
import { resolveFrontendRoots } from "./frontend-roots.js";
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

const PUBLIC_PAGE_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_STATIC_ASSET_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/manifest.webmanifest",
]);
const PUBLIC_HEALTH_PATH = "/health";
const PUBLIC_POST_PATHS = new Set(["/api/auth/login", "/api/auth/signup"]);
// This pattern routes frontend files through the Vite middleware; it does not
// grant public access. Only the exact paths in the allow-lists above bypass auth.
const STATIC_FILE_REQUEST_PATTERN =
  /^(?:\/.*\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map)|\/assets\/|\/favicon\.ico|\/robots\.txt|\/manifest\.webmanifest)$/i;
const PROTECTED_API_PATHS = new Set(["/ready", "/openapi.json"]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function buildAuthDocument(mode: "login" | "signup", notice?: string): string {
  const action = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
  const title = mode === "login" ? "Login" : "Create account";
  const submitLabel = mode === "login" ? "Login" : "Create account";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sports_Paradise | ${title}</title>
    <style>
      body { font-family: sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      main { max-width: 420px; margin: 5rem auto; padding: 2rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
      h1 { margin-top: 0; }
      form { display: flex; flex-direction: column; gap: 0.85rem; }
      label { font-weight: 600; display: flex; flex-direction: column; gap: 0.35rem; }
      input { padding: 0.65rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
      input[type="password"] { font-family: sans-serif; }
      button { margin-top: 0.5rem; padding: 0.75rem 1rem; border: none; border-radius: 8px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
      a { color: #2563eb; }
      .switch { margin-top: 1rem; font-size: 0.95rem; }
      .notice { padding: 0.75rem; border-radius: 8px; background: #eff6ff; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      ${notice ? `<p class="notice" role="alert">${escapeHtml(notice)}</p>` : ""}
      <form method="post" action="${action}" accept-charset="utf-8">
        ${
          mode === "signup"
            ? `
          <label>
            First name
            <input name="firstName" type="text" required maxlength="100" autocomplete="given-name" />
          </label>
          <label>
            Last name
            <input name="lastName" type="text" required maxlength="100" autocomplete="family-name" />
          </label>
          `
            : ""
        }
        <label>
          Email address
          <input name="email" type="email" required maxlength="254" autocomplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minlength="8" maxlength="1024" autocomplete="current-password" />
        </label>
        <button type="submit">${submitLabel}</button>
      </form>
      <div class="switch">
        ${
          mode === "login"
            ? '<a href="/signup">Create an account</a>'
            : '<a href="/login">Already have an account? Log in</a>'
        }
      </div>
    </main>
  </body>
</html>`;
}

function isHtmlFormRequest(request: FastifyRequest): boolean {
  return request.headers.accept?.includes("text/html") ?? false;
}

function sendAuthFormNotice(
  request: FastifyRequest,
  reply: FastifyReply,
  mode: "login" | "signup",
  statusCode: number,
  notice: string,
): FastifyReply | null {
  if (!isHtmlFormRequest(request)) {
    return null;
  }
  return reply
    .code(statusCode)
    .header("cache-control", "no-store")
    .type("text/html; charset=utf-8")
    .send(buildAuthDocument(mode, notice));
}

function isPublicRoute(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD") {
    return (
      pathname === PUBLIC_HEALTH_PATH ||
      PUBLIC_PAGE_PATHS.has(pathname) ||
      PUBLIC_STATIC_ASSET_PATHS.has(pathname)
    );
  }
  return method === "POST" && PUBLIC_POST_PATHS.has(pathname);
}

function isProtectedPageRequest(
  pathname: string,
  acceptHeader: string | undefined,
): boolean {
  return (
    !isPublicRoute("GET", pathname) &&
    !PROTECTED_API_PATHS.has(pathname) &&
    !pathname.startsWith("/api/") &&
    (typeof acceptHeader === "string"
      ? acceptHeader.includes("text/html")
      : false)
  );
}

function sendAuthenticationDocument(
  reply: FastifyReply,
  mode: "login" | "signup",
  statusCode: number,
): FastifyReply {
  return reply
    .code(statusCode)
    .header("cache-control", "no-store")
    .type("text/html; charset=utf-8")
    .send(buildAuthDocument(mode));
}

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
            "application/x-www-form-urlencoded": {
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
            "application/x-www-form-urlencoded": {
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
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const fields: Record<string, string> = Object.create(null) as Record<
        string,
        string
      >;
      const formBody = typeof body === "string" ? body : body.toString("utf8");
      for (const [name, value] of new URLSearchParams(formBody)) {
        if (Object.prototype.hasOwnProperty.call(fields, name)) {
          done(
            Object.assign(new Error("Duplicate form field."), {
              statusCode: 400,
            }),
          );
          return;
        }
        fields[name] = value;
      }
      done(null, fields);
    },
  );

  const { webRoot, distRoot } = resolveFrontendRoots();
  const frontendDevServer =
    config.environment === "development"
      ? createViteDevServer({
          root: webRoot,
          server: {
            middlewareMode: true,
            host: "127.0.0.1",
            port: 5173,
            hmr: { port: 5173, host: "127.0.0.1" },
          },
          preview: { host: "127.0.0.1", port: 4173 },
          logLevel: "error",
          appType: "spa",
        })
      : null;

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
  if (config.environment === "development") {
    app.register(middie);
    if (frontendDevServer) {
      app.after(async () => {
        const viteServer = await frontendDevServer;
        app.use((request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://localhost")
            .pathname;
          const isFrontendRequest =
            pathname === "/" ||
            pathname.startsWith("/@") ||
            pathname.startsWith("/src/") ||
            STATIC_FILE_REQUEST_PATTERN.test(pathname);

          if (isFrontendRequest) {
            if (isPublicRoute(request.method ?? "GET", pathname)) {
              viteServer.middlewares(request, response, next);
              return;
            }

            const cookies = app.parseCookie(
              typeof request.headers.cookie === "string"
                ? request.headers.cookie
                : "",
            );
            void sessionService
              .authenticate(cookies[SESSION_COOKIE_NAME])
              .then((session) => {
                if (!session) {
                  if (
                    isProtectedPageRequest(pathname, request.headers.accept)
                  ) {
                    response.writeHead(401, {
                      "cache-control": "no-store",
                      "content-type": "text/html; charset=utf-8",
                    });
                    response.end(buildAuthDocument("login"));
                    return;
                  }

                  response.writeHead(401, {
                    "cache-control": "no-store",
                    "content-type": "application/json; charset=utf-8",
                  });
                  response.end(
                    JSON.stringify({ error: "Authentication required." }),
                  );
                  return;
                }

                viteServer.middlewares(request, response, next);
              })
              .catch(() => {
                if (!response.headersSent) {
                  response.writeHead(503, {
                    "cache-control": "no-store",
                    "content-type": "application/json; charset=utf-8",
                  });
                  response.end(
                    JSON.stringify({
                      error: "Authentication service unavailable.",
                    }),
                  );
                }
              });
            return;
          }

          next();
        });
      });
    }
  } else {
    app.register(fastifyStatic, {
      root: distRoot,
      prefix: "/",
      wildcard: false,
      serve: config.environment === "production",
    });
  }
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

    const pathname = new URL(request.raw.url ?? "/", "http://localhost")
      .pathname;
    if (isPublicRoute(request.method, pathname)) {
      return;
    }

    const session = await sessionService.authenticate(
      request.cookies[SESSION_COOKIE_NAME],
    );
    request.authSession = session;

    if (session) {
      return;
    }

    if (isProtectedPageRequest(pathname, request.headers.accept)) {
      return sendAuthenticationDocument(reply, "login", 401);
    }

    return reply.code(401).send({ error: "Authentication required." });
  });

  app.addHook("onClose", async () => {
    if (frontendDevServer) {
      await (await frontendDevServer).close();
    }
    await databasePool.end();
  });

  app.setErrorHandler((error, request, reply) => {
    const typedError = error as Error & {
      statusCode?: number;
      validation?: unknown[];
    };
    const isValidationError = Array.isArray(typedError.validation);
    const responseCode =
      typeof typedError.statusCode === "number" && typedError.statusCode > 0
        ? typedError.statusCode
        : 500;
    const pathname = new URL(request.raw.url ?? "/", "http://localhost")
      .pathname;
    const authMode =
      pathname === "/api/auth/login"
        ? "login"
        : pathname === "/api/auth/signup"
          ? "signup"
          : null;
    if (authMode && responseCode === 400 && isHtmlFormRequest(request)) {
      return sendAuthFormNotice(
        request,
        reply,
        authMode,
        responseCode,
        "Please complete the required fields with valid information and try again.",
      );
    }
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

  if (config.environment !== "production") {
    app.get("/", async (_request, reply) => {
      return reply.sendFile("index.html", webRoot, { maxAge: 0 });
    });
  }

  app.get("/login", async (_request, reply) => {
    return sendAuthenticationDocument(reply, "login", 200);
  });

  app.get("/signup", async (_request, reply) => {
    return sendAuthenticationDocument(reply, "signup", 200);
  });

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
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "signup",
            409,
            "An account with that email address already exists.",
          );
          if (formResponse) {
            return formResponse;
          }
          return reply.code(409).send({
            error: "An account with that email address already exists.",
          });
        }
        const formResponse = sendAuthFormNotice(
          request,
          reply,
          "signup",
          201,
          "Your account was created. You can now log in.",
        );
        if (formResponse) {
          return formResponse;
        }
        return reply.code(201).send({ user: result.account });
      } catch (error) {
        if (error instanceof AuthInputError) {
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "signup",
            400,
            error.message,
          );
          if (formResponse) {
            return formResponse;
          }
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
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "login",
            401,
            "Invalid email or password.",
          );
          if (formResponse) {
            return formResponse;
          }
          return reply.code(401).send({ error: "Invalid email or password." });
        }
        if (result.type === "deactivated") {
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "login",
            403,
            "Your account has been deactivated. Please contact support.",
          );
          if (formResponse) {
            return formResponse;
          }
          return reply.code(403).send({
            error: "Your account has been deactivated. Please contact support.",
          });
        }
        if (result.type === "throttled") {
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "login",
            429,
            "Too many login attempts. Try again later.",
          );
          if (formResponse) {
            return formResponse;
          }
          return reply.code(429).send({
            error: "Too many login attempts. Try again later.",
          });
        }

        setSessionCookie(reply, result.token, config.secureCookies);
        if (isHtmlFormRequest(request)) {
          return reply
            .code(303)
            .header("cache-control", "no-store")
            .header("location", "/")
            .send();
        }
        return reply.code(200).send({ user: result.account });
      } catch (error) {
        if (error instanceof AuthInputError) {
          const formResponse = sendAuthFormNotice(
            request,
            reply,
            "login",
            400,
            error.message,
          );
          if (formResponse) {
            return formResponse;
          }
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

  app.post("/api/admin/users/:id/deactivate", async (request, reply) => {
    const session = await sessionService.authenticate(
      request.cookies[SESSION_COOKIE_NAME],
    );
    if (!session) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const actor = await accountRepository.findAccountById(session.userId);
    if (!actor || actor.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden." });
    }

    const userId = String((request.params as { id?: string }).id ?? "");
    if (!userId) {
      return reply.code(400).send({ error: "A user id is required." });
    }

    const target = await accountRepository.findAccountById(userId);
    if (!target) {
      return reply.code(404).send({ error: "User not found." });
    }

    const status = await accountRepository.deactivateAccount(userId);
    if (status === "already_deactivated") {
      return reply
        .code(409)
        .send({ error: "User account is already deactivated." });
    }
    if (status === "not_found") {
      return reply.code(404).send({ error: "User not found." });
    }

    return reply.code(200).send({
      user: {
        id: target.id,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        status: "deactivated" as const,
      },
    });
  });

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
