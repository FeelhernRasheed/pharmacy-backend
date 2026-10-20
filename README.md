# Pharmacy Management System — Backend API

NestJS + PostgreSQL backend for managing a pharmacy: medicines, inventory batches, purchasing, sales, payments, prescriptions, dispensing, stock adjustments, expiry/low-stock monitoring, audit logs, and reporting.

## Tech stack

- **Framework:** NestJS 12 (TypeScript)
- **Database:** PostgreSQL (raw SQL via `pg` pool)
- **Auth:** JWT (passport-jwt) with role-based access control
- **Validation:** class-validator + global `ValidationPipe` (whitelist, transform)
- **Docs:** Swagger UI at `/api-docs`

## Project setup

1. Install dependencies:

```bash
npm install
```

2. Create the database and apply the schema baseline (PostgreSQL):

```sql
CREATE DATABASE "Pharmacy-db";
```

```bash
# apply the committed schema baseline (see db/README.md for details)
# Requires PostgreSQL 18+ client tooling: the dump contains a
# PostgreSQL 18 \restrict command that older psql versions reject.
psql -h localhost -U postgres -d "Pharmacy-db" -v ON_ERROR_STOP=1 -f db/schema-baseline.sql
```

Two additional SQL scripts exist under `db/migrations/` and `db/roles/`
(least-privilege role, FK indexes). They are **not applied anywhere** and
require explicit approval — see `db/README.md`.

3. Configure environment variables — copy `.env.example` to `.env` and fill in the values:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Pharmacy-db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=a-long-random-secret
CORS_ORIGIN=http://localhost:3000
```

4. Start the server:

```bash
# development
npm run start

# watch mode
npm run start:dev

# production
npm run build
npm run start:prod
```

Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## Authentication

All endpoints (except `/`, `/hello`, `/health/live`, `/health/ready`, and `/auth/login`) require a JWT bearer token.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

Response includes `access_token`. Send it on every request:

```
Authorization: Bearer <access_token>
```

Tokens expire after 1 hour. Every authenticated request re-checks the user in the database — deleting or deactivating a user revokes their access immediately.

## Roles & permissions

| Role | Capabilities |
|---|---|
| **ADMIN** | Everything, including user management, sales/patient deletion |
| **PHARMACIST** | Medicines, categories, inventory, purchasing, prescriptions, dispensing, stock adjustments, sales + payments |
| **CASHIER** | Patients, sales, sale items, payments, read-only elsewhere |

Write rules per module:

| Module | Create/Update | Delete |
|---|---|---|
| Medicines, Categories, Inventory, Suppliers | ADMIN, PHARMACIST | ADMIN, PHARMACIST |
| Purchases, Purchase Items | ADMIN, PHARMACIST | ADMIN, PHARMACIST |
| Prescriptions, Dispensing, Stock Adjustments | ADMIN, PHARMACIST | — |
| Sales, Sale Items, Payments, Patients | ADMIN, PHARMACIST, CASHIER | ADMIN only (sales/patients) |
| Users | ADMIN | — |

## Business rules

- **Expiry:** batches past their expiry date cannot be received, sold, or dispensed (400).
- **Stock:** adding sale items and dispensing items decrements batch stock atomically; insufficient stock is rejected (400).
- **Payments:** each payment is validated against the sale's remaining balance inside a transaction with row locking; overpayment and payments on cancelled sales are rejected.
- **Cancellations:** cancelling a sale restores stock and is blocked if completed payments exist; cancelled sales cannot be reopened.
- **Deletes:** deleting a sale/purchase with items or payments is rejected (409); deleting an inventory batch with stock or references is rejected.
- **Adjustments:** stock adjustments only reduce quantity (DAMAGE / EXPIRED / LOST / CORRECTION).
- **Audit log:** every create/update/delete records the acting user in `audit_logs`.

## API surface

| Tag | Base path | Endpoints |
|---|---|---|
| Auth | `/auth` | login |
| Health | `/health` | live, ready (public probes) |
| App | `/` | root greeting, hello, db-test (ADMIN) |
| Medicines | `/medicines` | CRUD |
| Categories | `/categories` | CRUD |
| Inventory | `/inventory` | batch CRUD |
| Suppliers | `/suppliers` | CRUD |
| Purchases | `/purchases` | CRUD |
| Purchase Items | `/purchase-items` | list, create |
| Patients | `/patients` | CRUD |
| Sales | `/sales` | CRUD |
| Sale Items | `/sale-items` | list, create |
| Payments | `/payments` | list, by-sale, by-status, create |
| Prescriptions | `/prescriptions` | list, get, create, add item |
| Dispensing | `/dispensing` | list, get, create, dispense item |
| Stock Adjustments | `/stock-adjustments` | list, get, create |
| Expiry Management | `/expiry-management` | expired, expiring-soon, valid |
| Low Stock | `/low-stock` | low stock list |
| Reports | `/reports` | sales, inventory, expiry, purchases, payments |
| Users | `/users` | list, get, create, update |
| Audit Logs | `/audit-logs` | list, get |

Full request/response schemas, parameters, and role requirements are in the Swagger UI.

## Error responses

All errors follow a consistent shape:

```json
{
  "statusCode": 400,
  "message": "Payment exceeds remaining balance. Remaining amount: 28.00",
  "error": "Bad Request"
}
```

- `400` — validation failure or business-rule violation
- `401` — missing/invalid token or inactive user
- `403` — authenticated but not authorized for the role
- `404` — resource not found
- `409` — conflict (e.g. deleting referenced data, duplicate username)
- `500` — internal error (details are never leaked to clients)

## Testing

```bash
# unit tests (46 suites, 138 tests; no database required — all DB access is mocked)
npm test

# coverage
npm run test:cov

# e2e tests (3 suites, 17 tests; boot the app against a PostgreSQL database)
npm run test:e2e

# integration suite (1 suite, 34 tests; full purchase → inventory → sales →
# payments → reports workflow against a real PostgreSQL database)
# Single-line form (works in PowerShell and bash; run from the project root):
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/integration/jest-e2e-integration.json --runInBand

# lint (oxlint, type-aware)
npm run lint

# full TypeScript type-check (includes test files)
npx tsc --noEmit -p tsconfig.json

# production build
npm run build
```

The e2e and integration suites **must** be pointed at an isolated test
database, never at production data. Override the database environment
variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
`JWT_SECRET`, and the `RATE_LIMIT_*` / `AUTH_RATE_LIMIT_*` variables)
before running them. The integration suite creates uniquely-suffixed
fixture rows and removes them afterwards; `test_admin` and the seeded
test supplier are never touched.

## Environment & security notes

- `.env` is gitignored; only `.env.example` is committed (placeholders only).
- Passwords are hashed with bcrypt (cost 10); `password_hash` is never returned by any endpoint.
- `JWT_SECRET` is required — the app refuses to start without it, and in
  production it must be at least 32 characters (enforced at startup).
- CORS: restrict origins via `CORS_ORIGIN` (comma-separated). Unset in
  production disables cross-origin requests entirely.
- Swagger UI is enabled in development and disabled in production by
  default (`SWAGGER_ENABLED` overrides).
- Stack traces and internal errors are stripped from non-HTTP exception
  responses by a global exception filter; readiness failures return a
  generic 503 with details logged server-side only.
- Rate limiting is applied globally and more strictly on `/auth/login`.

## Docker

A multi-stage `Dockerfile` (Node 22 slim, non-root user, prod-only
dependencies) is provided in the repository root (currently untracked —
include it in a commit deliberately, not by accident).

```bash
docker build -t pharmacy-backend .

docker run -d --name pharmacy-backend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=<db-host> \
  -e DB_PORT=5432 \
  -e DB_NAME="Pharmacy-db" \
  -e DB_USER=<db-user> \
  -e DB_PASSWORD=<secret> \
  -e JWT_SECRET=<at-least-32-chars> \
  pharmacy-backend
```

For `<db-user>`: `pharmacy_app` is the dedicated least-privilege
application role created by `db/roles/001_app_least_privilege_role.sql`,
which is **pending approval and not applied yet** — use it only after
that script has been approved, applied, and its password set. Until
then, use the currently configured application database user. Do **not**
run the application as the `postgres` superuser in production; applying
the least-privilege role script is the prerequisite for removing that
access (see Production deployment limitations).

Never bake `.env` into the image (`.dockerignore` excludes it). Pass
secrets at runtime via environment or your orchestrator's secret store.

## Health checks & troubleshooting

| Endpoint | Purpose | Expected |
|---|---|---|
| `GET /health/live` | Liveness — process is up | `200 {"status":"ok"}` |
| `GET /health/ready` | Readiness — database reachable (`SELECT 1`) | `200 {"status":"ok"}`, or generic `503` if the DB is down |

- **App exits at startup with "Invalid environment configuration"** —
  a required variable is missing or out of range; the message lists
  every issue without revealing secret values.
- **`503` from `/health/ready`** — the database is unreachable or the
  pool cannot connect; check DB_HOST/DB_PORT/credentials and that
  PostgreSQL is running.
- **`429` responses** — rate limit hit; tune `RATE_LIMIT_*` /
  `AUTH_RATE_LIMIT_*`. Limits are in-memory and per-instance.
- **`401` after a user is deleted or deactivated** — expected: every
  authenticated request re-checks the user in the database.

## Backup, restore & rollback

```bash
# backup (logical dump)
pg_dump -h <host> -U <user> -d "Pharmacy-db" -Fc -f pharmacy.dump

# restore into an empty database
pg_restore -h <host> -U <user> -d "Pharmacy-db" -v pharmacy.dump
```

- Schema drift check (read-only): `pg_dump --schema-only ... | diff db/schema-baseline.sql -`
- The schema baseline (`db/schema-baseline.sql`) is a schema-only
  snapshot; it creates structure, not data.
- Rollback procedures for the two pending SQL scripts (indexes,
  least-privilege role) are documented inside each script and in
  `db/README.md`.

## Production deployment limitations

Known limitations for an internal, single-instance deployment:

1. **Rate limiting is in-memory** — counters are per-process and reset
   on restart; move to a shared store (e.g., Redis) before scaling to
   multiple replicas.
2. **No refresh-token rotation** — clients hold a single short-lived
   JWT (default `1h`); there is no revocation list. Keep `JWT_EXPIRY`
   short and serve only over HTTPS.
3. **Single instance assumed** — no clustering/session sharing is
   configured; run exactly one application instance against the database.
4. **Pending database hardening** — `db/migrations/001_fk_indexes.sql`
   (FK index creation) and `db/roles/001_app_least_privilege_role.sql`
   (least-privilege `pharmacy_app` role) are written and reviewed but
   **not applied**; the app currently connects as a privileged user.
   Both require explicit approval — see `db/README.md`.
5. **No statement timeout** — long-running queries are not bounded at
   the database level; consider `statement_timeout` for hostile inputs.
