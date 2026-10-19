# Database folder

Working copy artifacts for schema and database operations. **Nothing in this
folder has been applied to any database** unless a file explicitly says so.

| Path | Status | Purpose |
|---|---|---|
| `schema-baseline.sql` | Snapshot (read-only) | `pg_dump --schema-only` of the current `Pharmacy-db` structure. Use it to diff future drift: `pg_dump --schema-only ... | diff schema-baseline.sql -` |
| `migrations/001_fk_indexes.sql` | **NOT APPLIED — awaiting approval** | `CREATE INDEX CONCURRENTLY` for the 20 unindexed foreign-key columns |
| `roles/001_app_least_privilege_role.sql` | **NOT APPLIED — awaiting approval** | Creates `pharmacy_app` (DML-only) so the API stops connecting as `postgres` |

## Rules

1. Never run a file from `migrations/` or `roles/` against the working
   database without explicit approval.
2. `001_fk_indexes.sql` must run **without** `--single-transaction` /
   `-1` because `CREATE INDEX CONCURRENTLY` cannot run in a transaction.
3. Regenerating `schema-baseline.sql` is a read-only operation
   (`pg_dump --schema-only --no-owner --no-privileges`) and is always
   allowed.

## Applying an approved migration

```bash
# Windows (PowerShell)
$env:PGPASSWORD = '<postgres-password>'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h localhost -p 5432 -U postgres -d Pharmacy-db `
  -v ON_ERROR_STOP=1 -f db\migrations\001_fk_indexes.sql
```

Verify afterwards:

```sql
SELECT count(*) FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
-- expected after 001: 20
```
