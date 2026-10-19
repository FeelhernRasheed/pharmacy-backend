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

2. Create the database (PostgreSQL):

```sql
CREATE DATABASE "Pharmacy-db";
```

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

All endpoints (except `/`, `/hello`, and `/auth/login`) require a JWT bearer token.

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
| App | `/` | health, hello, db-test (ADMIN) |
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
# unit tests (41 suites, 65 tests)
npm test

# coverage
npm run test:cov

# lint
npm run lint

# build
npm run build
```

## Environment & security notes

- `.env` is gitignored; only `.env.example` is committed.
- Passwords are hashed with bcrypt (cost 10); `password_hash` is never returned by any endpoint.
- `JWT_SECRET` is required — the app refuses to start without it.
- CORS is enabled; restrict origins via `CORS_ORIGIN` (comma-separated) in production.
- Stack traces and internal errors are stripped from non-HTTP exception responses by a global exception filter.
