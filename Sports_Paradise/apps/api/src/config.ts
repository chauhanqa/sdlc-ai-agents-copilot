export interface AppConfig {
  host: string;
  port: number;
  databaseUrl: string;
  environment: string;
  jwtSigningKey: Uint8Array;
  webOrigin: string;
  secureCookies: boolean;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

export function getRequiredEnvValue(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export function redactConnectionString(value: string): string {
  if (!value) {
    return value;
  }

  return value.replace(
    /(postgres(?:ql)?:\/\/)([^@\s]+)@/gi,
    (_, prefix: string, userinfo: string) => {
      const [rawUsername, ...rawPasswordParts] = userinfo.split(":");
      const username = rawUsername.length > 0 ? "[REDACTED]" : "";
      const password = rawPasswordParts.length > 0 ? ":[REDACTED]" : "";
      return `${prefix}${username}${password}@`;
    },
  );
}

export function buildAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const portValue = env.PORT?.trim() ?? DEFAULT_PORT.toString();
  const port = Number(portValue);

  if (
    !/^\d+$/.test(portValue) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("PORT must be a valid integer between 1 and 65535.");
  }

  const databaseUrl = getRequiredEnvValue("DATABASE_URL", env);
  const jwtSigningSecret = getRequiredEnvValue("JWT_SIGNING_KEY", env);
  const jwtSigningKey = new TextEncoder().encode(jwtSigningSecret);
  if (jwtSigningKey.byteLength < 32) {
    throw new Error("JWT_SIGNING_KEY must be at least 32 UTF-8 bytes.");
  }

  const webOriginValue = env.WEB_ORIGIN?.trim() || "http://localhost:3000";
  let webOrigin: URL;
  try {
    webOrigin = new URL(webOriginValue);
  } catch {
    throw new Error("WEB_ORIGIN must be a valid HTTP or HTTPS origin.");
  }
  if (
    !["http:", "https:"].includes(webOrigin.protocol) ||
    webOrigin.username ||
    webOrigin.password ||
    webOrigin.pathname !== "/" ||
    webOrigin.search ||
    webOrigin.hash
  ) {
    throw new Error("WEB_ORIGIN must be a valid HTTP or HTTPS origin.");
  }

  const environment = env.NODE_ENV?.trim() || "development";
  const loopbackWebOrigin = ["localhost", "127.0.0.1", "[::1]"].includes(
    webOrigin.hostname,
  );
  return {
    host: env.HOST?.trim() || DEFAULT_HOST,
    port,
    databaseUrl,
    environment,
    jwtSigningKey,
    webOrigin: webOrigin.origin,
    secureCookies:
      environment === "production" ||
      webOrigin.protocol === "https:" ||
      !loopbackWebOrigin,
  };
}
