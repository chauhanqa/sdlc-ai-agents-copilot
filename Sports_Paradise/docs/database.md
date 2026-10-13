# Local PostgreSQL and Schema Conventions

## Prerequisites and Configuration

Use Node.js 20.19.0 or later, npm, Docker Desktop with its Linux/WSL2 engine
running (or another compatible Docker Compose runtime), and make the Docker
CLI available on `PATH`. From the `Sports_Paradise` directory, copy
`.env.example` to `.env`, then replace both local password placeholders with
unique local values. Keep `.env` untracked; `.gitignore` excludes it.
Replace `JWT_SIGNING_KEY` with a cryptographically random value of at least
32 UTF-8 bytes. `WEB_ORIGIN` defaults to the local Vite origin; set it to the
exact browser origin when using a different local or deployed frontend.
Production and HTTPS origins use `Secure` session cookies. The API fails
startup if the JWT key is missing or too short and never sends it to browser
configuration.

`POSTGRES_USER` and `POSTGRES_PASSWORD` configure the local bootstrap
administrator used by the container initialization process; never use this
superuser account for application connections. The init script creates a
separate `POSTGRES_APP_USER` with `POSTGRES_APP_PASSWORD` for application and
migration access. The application role is not a PostgreSQL superuser. The
`DATABASE_URL` must contain the application role credentials and point to the
local database. URL-encode any reserved characters in the password component.
Never use production credentials or real user data in local development.

Compose binds PostgreSQL to `127.0.0.1` only, waits until a SQL query succeeds
against the configured database before provisioning the app role, and
persists data in the named `sports-paradise-postgres-data` volume. A server
readiness response alone is insufficient during first-time initialization,
because PostgreSQL can accept connections before the configured database has
been created. The Compose configuration invokes the checked-in role helper
and parameterized SQL on each startup. Role creation and credential updates
use PostgreSQL-safe quoting; provisioning failures stop the database process.
The health check authenticates as the app role and executes a query, so
PostgreSQL is not considered healthy until application access works. Do not
expose the database directly to browser code.

## Start and Stop

```powershell
Copy-Item .env.example .env
# Edit .env and replace both local password placeholders before starting.
npm run db:up
```

Inspect `docker compose ps` and `docker compose logs database` if the database
does not become healthy. Missing required Compose settings fail with an
actionable message. To stop services without deleting local data:

```powershell
npm run db:down
```

`docker compose down` retains the named database volume. Do not remove that
volume as a routine cleanup step; it contains local database state. The
foundation does not authorize destructive production operations.

## Application Database Access

Application processes connect using `DATABASE_URL` and the non-superuser
application role. The backend owns database access; the frontend receives no
database credentials. Backend code should create a bounded `pg.Pool` using
`createDatabasePool` from `apps/api/src/db/pool.ts` and check readiness using
`checkDatabaseConnection`. Do not log the connection URL. Connectivity
failures are surfaced with an actionable message and retained as an error
cause for diagnostics.

## Migrations and Schema Ownership

`node-pg-migrate` is the schema migration tool. Create a versioned TypeScript
migration from the project root with:

```powershell
npm run db:migration:create --workspace @sports-paradise/api -- add-description
```

Review each migration and its rollback before applying it. From the project
root, apply pending migrations using the `.env` configuration:

```powershell
npm run db:migrate --workspace @sports-paradise/api
```

The migration history is stored in PostgreSQL's `pgmigrations` table. Keep
migrations in `apps/api/migrations/` and commit them with the application code
that needs the schema. Do not make undocumented manual schema edits. The
application role owns objects it creates in the local `public` schema.

The authentication persistence migration adds `users`, `auth_sessions`, and
`login_throttle_state` without modifying foundation data. Emails are stored
normalized and uniquely constrained; accounts default to active, non-admin
status, and password hashes must use Argon2id encoding. Session records contain
only a session identifier, account reference, timestamps, and revocation
state. Failed-login state is keyed by a 64-character digest and caps its
counter at five. No account, administrator, password, or signing secret is
seeded by the migration.

`POST /api/auth/signup` normalizes email addresses, hashes passwords with
Argon2id, and creates automatically activated, non-admin accounts.
`POST /api/auth/login` returns the session in an HttpOnly cookie only after
valid credentials for an active account. Unknown accounts and incorrect
passwords receive the same generic response; valid credentials for a
deactivated account receive the specified support message. Five failed
attempts within a five-minute window trigger a persisted five-minute
cooldown, which a successful login clears.

Run `npm run test:db:migrations` to apply and roll back migrations against an
isolated disposable PostgreSQL Compose project, check account/session/throttle
constraints, exercise session and account repositories, concurrent normalized
signup uniqueness, Argon2id persistence, login cooldown/recovery, current-session
revocation, and verify an unrelated foundation record survives both migration
directions. The test uses synthetic credentials and removes only its own
containers and volume.

This foundation defines no sports-domain tables: domain entities, constraints,
personal-data classification, and retention require approved feature
requirements. No baseline/no-op migration is created solely to initialize an
empty project.

## Diagnostics and Limitations

Run `npm run test:db:provisioning` to exercise role creation with
shell-significant password characters, credential rotation, app-role
authentication, and fail-fast configuration using isolated disposable Compose
projects. Failed Compose commands include captured stdout/stderr with
configured credential values redacted. The test uses synthetic credentials
and removes its own containers and volumes.

If `npm run db:up` fails, confirm Docker Compose is installed and running,
`.env` exists and contains all required settings, and the configured local port
is available. If the app cannot connect, verify its `DATABASE_URL` uses the
application—not bootstrap—credentials and that `docker compose ps` reports a
healthy database. The application reports unavailable-database failures
explicitly rather than substituting in-memory storage.

Docker Compose requires a compatible container runtime to be installed and
running. On Windows, start Docker Desktop and confirm its selected Linux
container engine is ready; on other platforms, confirm the Docker daemon or
compatible Compose runtime is available. If startup still fails, check the
runtime's own diagnostics, then inspect `docker compose ps` and
`docker compose logs database`. PostgreSQL startup and application-role
initialization are covered by the recorded TASK-003 verification and can be
rechecked with `npm run test:db:provisioning`.
