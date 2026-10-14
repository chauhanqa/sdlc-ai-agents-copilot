const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const webBaseUrl = "http://localhost:3000";

async function request(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Could not reach ${url}: ${detail}`, { cause: error });
  }

  return response;
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

const healthResponse = await request(`${apiBaseUrl}/health`);
if (!healthResponse.ok) {
  throw new Error(`API health check returned HTTP ${healthResponse.status}.`);
}
const health = await readJson(healthResponse, "API health endpoint");
if (health.status !== "ok") {
  throw new Error("API health endpoint returned an unexpected status.");
}

const protectedOperations = [
  {
    label: "API readiness",
    url: `${apiBaseUrl}/ready`,
  },
  {
    label: "OpenAPI contract",
    url: `${apiBaseUrl}/openapi.json`,
  },
  {
    label: "echo API operation",
    url: `${apiBaseUrl}/api/echo`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "integration-smoke" }),
    },
  },
];

for (const { label, url, options } of protectedOperations) {
  const response = await request(url, options);
  if (response.status !== 401) {
    throw new Error(
      `${label} returned HTTP ${response.status} without a session, expected 401.`,
    );
  }
  const payload = await readJson(response, label);
  if (payload.error !== "Authentication required.") {
    throw new Error(`${label} returned an unexpected unauthenticated payload.`);
  }
}

const loginResponse = await request(`${apiBaseUrl}/login`);
if (loginResponse.status !== 200) {
  throw new Error(`Public login page returned HTTP ${loginResponse.status}.`);
}
const loginHtml = await loginResponse.text();
if (!loginHtml.includes('action="/api/auth/login"')) {
  throw new Error("Public login page did not render the standalone auth form.");
}

const protectedPageResponse = await request(`${apiBaseUrl}/dashboard`, {
  headers: { Accept: "text/html,application/xhtml+xml" },
});
if (protectedPageResponse.status !== 401) {
  throw new Error(
    `Protected page navigation returned HTTP ${protectedPageResponse.status}, expected 401.`,
  );
}
if (protectedPageResponse.headers.get("location")) {
  throw new Error("Protected page navigation should not redirect.");
}
const protectedPageHtml = await protectedPageResponse.text();
if (!protectedPageHtml.includes('action="/api/auth/login"')) {
  throw new Error("Protected page request did not render the login document.");
}

const webResponse = await request(webBaseUrl);
if (!webResponse.ok) {
  throw new Error(`Frontend returned HTTP ${webResponse.status}.`);
}
const webHtml = await webResponse.text();
if (!webHtml.includes('<div id="root"></div>')) {
  throw new Error("Frontend did not serve the application shell.");
}

console.log("Local integration smoke checks passed:");
console.log("- public API liveness and protected readiness/API operations");
console.log("- public login page and protected page auth gate");
console.log("- frontend application shell delivery");
