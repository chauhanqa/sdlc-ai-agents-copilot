# Development Standards

## Stack and Workspace

Use the approved TypeScript stack: React with Vite for the browser frontend,
Node.js with Fastify for the backend, and PostgreSQL for persistence. The npm
workspaces are organized under `apps/` for runnable applications and
`packages/` for shared contracts or libraries. Keep frontend, backend, and
data-access responsibilities separate; only the backend may connect to the
database.

Do not add a framework, runtime dependency, or application layer without an
approved requirement and architecture fit. Pin dependencies in the workspace
manifest and lockfile. Keep generated output and local configuration out of
source control.

## TypeScript and Code Structure

- Enable and preserve strict TypeScript checking. Prefer explicit domain and
  boundary types over implicit `any` or unsafe type assertions.
- Keep code close to the package that owns its behavior; move code into shared
  packages only when multiple workspaces need a stable shared contract.
- Keep presentation, HTTP handling, application logic, and persistence
  responsibilities distinct.
- Use descriptive names and small cohesive modules. Avoid unrelated
  refactoring in feature changes.
- Keep browser code free of server-only configuration, database access, and
  credentials.

## Formatting and Linting

Prettier is the formatter and ESLint is the static lint tool. Run
`npm run format` to format project source, configuration, and contributor
documentation. Run `npm run format:check` to validate formatting without
changing files. Approved SDLC baseline documents under `docs/sdlc/` are
excluded from bulk formatting and must only be updated through their
governance workflow.

Run `npm run lint` before requesting review. Resolve lint errors rather than
silencing rules broadly. A narrowly scoped rule suppression must explain the
specific exceptional case.

## Validation and Error Handling

Validate untrusted input at server-side boundaries. Frontend validation may
improve usability but never replaces backend validation. Parse and validate
required configuration at startup; report missing setting names and
remediation steps without revealing secret values. Fail visibly when required
services are unavailable. Do not use silent defaults, success-shaped
fallbacks, or unhandled ignored errors for required behavior.

## Automated Tests

Place tests next to the behavior they verify or in the owning workspace's
established test directory. Use the workspace test command (`npm test`) for
repeatable execution. Tests must be deterministic, focused, and use synthetic
data; do not use committed credentials or real sensitive data.

Cover normal behavior and relevant error or boundary cases. Changes to API
contracts must include tests for the contract behavior. Database integration
tests must use an isolated local/test database and must not access production
data. A passing build alone is not a substitute for required tests.

## Secrets and Configuration

Keep environment-specific settings outside source code. Tracked example
configuration may contain names and safe placeholders only. Local
secret-bearing environment files must remain ignored. Never put credentials
in source, tests, documentation, frontend bundles, logs, or test fixtures.

## Review Readiness

Before requesting review:

1. Run formatting check, lint, type-check, build, and all tests affected by
   the change.
2. Inspect the complete diff for unrelated changes, debug output, credentials,
   unsafe casts, and missing failure-path tests.
3. Update directly relevant contributor or interface documentation.
4. Describe the change and report the exact validation commands and results.
5. Keep scope consistent with approved requirements and architecture; escalate
   material requirement or architecture changes instead of deciding them in
   implementation.

## Local Startup and Contributor Onboarding

Use the approved local workflow from the repository root:

1. Copy `.env.example` to `.env` and replace placeholder values with local-only
   secrets. Keep the file outside Git tracking; the repository ignores it.
2. Ensure Docker Desktop or a compatible Docker engine is installed and the
   local PostgreSQL container can start. On Windows, ensure the WSL/Linux
   engine is available before running the database workflow.
3. Start the database and app stack with `npm run dev`.
   - The root script provisions PostgreSQL and launches the backend API.
   - In development, the API serves the browser app through the Fastify
     ingress on `http://localhost:3000`, which keeps protected page auth checks
     and same-origin session cookies aligned with the approved boundary.
   - The API waits for the database and exposes readiness on
     `http://localhost:3000/ready`.
   - Do not launch a standalone Vite server for local development; the direct
     `5173` entry bypasses the protected-page authorization boundary.
   - Run `npm run integration:smoke` in a second terminal to verify the API,
     database readiness, browser-origin contract, and frontend shell together.
4. Use `npm run db:down` to stop the database container when you are done.
5. If startup fails, inspect the exact error message and follow the failing
   step instead of hiding the issue: confirm the `.env` values are present,
   confirm Docker is running, and confirm the database service is healthy.
6. Keep database credentials in `.env` only, never in source, logs, or the
   browser bundle. The backend remains the only place that connects to the
   database.

The repository's root scripts (`npm run dev`, `npm run dev:api`,
`npm run db:up`, and `npm run db:down`) are the approved local developer
commands for the foundation stack. The browser is served through the Fastify
API at `http://localhost:3000`; standalone Vite startup is intentionally not
used in the approved development workflow.
