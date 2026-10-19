# Monitoring and observability

Operational endpoints and logging behaviour for the Pharmacy
Management System backend.

## Health endpoints

Both probes are public (no JWT) and are intended for load-balancer,
container-orchestrator, or uptime-checker use.

### `GET /health/live` — liveness

Reports that the application process is running and able to serve
HTTP requests. It performs **no** database access.

```json
{ "status": "ok" }
```

- `200` — process is alive.
- The probe never returns `503`: if the process cannot answer at
  all, the orchestrator should treat that as liveness failure and
  restart it.

### `GET /health/ready` — readiness

Checks that the application can serve requests by running a bounded
`SELECT 1` against PostgreSQL through the existing connection pool.

```json
{ "status": "ok" }
```

- `200` — database reachable; safe to route traffic.
- `503` — database unreachable:

```json
{
  "statusCode": 503,
  "message": "Service unavailable",
  "error": "Service Unavailable"
}
```

Operational meaning of `503`: take the instance out of the rotation
(don't route business traffic), keep the process running, and check
the logs and database availability. The application does **not**
crash on database failure; the pool recovers automatically once the
database is reachable again.

Responses never include connection strings, hosts, ports, SQL, or
exception messages. The underlying error is logged server-side only
(see below).

Probe cadence guidance: every 10–30 s is typical. Both endpoints are
covered by the global per-IP rate limit (default 100 requests / 60 s)
and will return `429` above it.

## Request correlation (`X-Request-Id`)

Every response carries an `X-Request-Id` header:

- A valid incoming `X-Request-Id` (`[A-Za-z0-9._-]{8,64}`) is reused,
  so upstream proxies or clients can propagate their own trace IDs.
- Missing or malformed values are replaced with a generated UUID —
  header values can never poison logs.

Unhandled server errors log one line including the correlation ID:

```
ERROR [AllExceptionsFilter] Unhandled exception on GET /sales [requestId=...]
```

Use the ID to match client reports against application logs.

## Logging

- Format: NestJS `Logger` with context labels (e.g.
  `[HealthService]`, `[DatabaseService]`, `[AllExceptionsFilter]`).
- Readiness failures log a single `WARN` per failed check with the
  internal cause (server-side only).
- Unhandled exceptions log once in the global exception filter;
  expected HTTP errors (4xx, and deliberate 5xx such as readiness
  `503`) are not logged, so nothing is logged twice.
- Never logged: passwords, password hashes, JWTs, `Authorization`
  headers, database credentials, or patient/pharmacy data.

## Metrics

No metrics platform is deployed (deliberate Phase 4 decision — keep
infrastructure lightweight). The health endpoints and structured
logs are the observability surface. If metrics are needed later,
expose a dedicated endpoint behind authentication or network
restriction rather than reusing the public probes.
