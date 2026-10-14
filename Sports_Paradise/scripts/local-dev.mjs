import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

try {
  process.loadEnvFile(path.join(projectRoot, ".env"));
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

const npmCliPath = process.env.npm_execpath;
const apiHealthUrl = "http://localhost:3000/health";
const webUrl = "http://localhost:3000";

if (!npmCliPath) {
  throw new Error("Start the local stack with `npm run dev`.");
}

function startProcess(name, args) {
  const child = spawn(process.execPath, [npmCliPath, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: projectRoot,
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`${name} exited with code ${code}.`);
    }
  });

  return child;
}

async function waitForService(url, timeoutMs, label, acceptedStatusCodes = [200]) {
  const started = Date.now();
  let lastStatus;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || acceptedStatusCodes.includes(response.status)) {
        return;
      }
      lastStatus = response.status;
    } catch {
      // retry until the service accepts requests
    }

    await delay(1000);
  }

  const statusMessage = lastStatus ? ` (last HTTP status ${lastStatus})` : "";
  throw new Error(`Timed out waiting for ${label} at ${url}${statusMessage}.`);
}

async function waitForDatabaseStartup() {
  return await new Promise((resolve, reject) => {
    const database = startProcess("database", ["run", "db:up"]);

    database.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Database startup failed with exit code ${code}.`));
    });
  });
}

let api;

function shutdown() {
  if (api && !api.killed) {
    api.kill("SIGINT");
  }

  process.exit(0);
}

try {
  await waitForDatabaseStartup();
  api = startProcess("api", ["run", "dev:api"]);

  // `db:up` waits for the PostgreSQL application-role health check; `/health`
  // is the unauthenticated liveness endpoint for the API. The browser is served
  // through the Fastify ingress on the same loopback origin to keep the auth
  // boundary consistent for protected pages and same-origin session requests.
  await waitForService(apiHealthUrl, 60000, "API");
  await waitForService(webUrl, 60000, "Web app", [200, 401]);

  console.log("Sports_Paradise local development environment is running.");
  console.log(`API health endpoint: ${apiHealthUrl}`);
  console.log(`Browser entry: ${webUrl}`);
  console.log("Press Ctrl+C to stop the API process.");

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise(() => {});
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Local startup failed.";

  console.error(message);

  if (api && !api.killed) {
    api.kill("SIGINT");
  }

  process.exit(1);
}
