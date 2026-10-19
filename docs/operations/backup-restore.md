# Backup and restore runbook

## What to back up

- **Logical backup**: the `Pharmacy-db` database (schema + data).
- **Schema drift reference**: `db/schema-baseline.sql` (structure only).

`Pharmacy-db` is small (17 tables, hundreds of rows), so a logical
`pg_dump` backup is sufficient and fast. No filesystem blobs exist.

## Creating a backup (read-only, always safe)

```powershell
$env:PGPASSWORD = '<postgres-password>'   # do not echo or commit
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h localhost -p 5432 -U postgres -d Pharmacy-db `
  --no-owner --no-privileges `
  -f "backups\pharmacy-db-$(Get-Date -Format yyyyMMdd-HHmm).sql"
```

Compress large backups:

```powershell
& pg_dump ... -Fc -f backups\pharmacy-db.dump   # custom format, compressed
```

Recommended cadence: daily automated dump + before/after every migration.

## Restoring (requires approval — this overwrites data)

```powershell
# Plain SQL dump
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h localhost -p 5432 -U postgres -d Pharmacy-db `
  -v ON_ERROR_STOP=1 -f backups\pharmacy-db-YYYYMMDD-HHmm.sql

# Custom-format dump
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
  -h localhost -p 5432 -U postgres -d Pharmacy-db `
  --clean --if-exists --no-owner backups\pharmacy-db.dump
```

Restore procedure:

1. Stop the application (so no transactions race the restore).
2. Take a fresh pre-restore dump of the current state.
3. Run the restore command above.
4. Restart the application and run `/db-test` (admin token required).
5. Verify row counts against the expected figures in the phase reports.

## Verifying a backup

```powershell
# Count tables in a plain-SQL dump
Select-String -Path backups\pharmacy-db-*.sql -Pattern '^CREATE TABLE' |
  Measure-Object
# expected: 17
```

## Safety rules

- Backups may contain real patient/credential data — never commit them to
  Git; `backups/` must stay ignored.
- Restore is destructive to the current database state and therefore
  always requires explicit approval, even in development.
- Never print or store the `PGPASSWORD` value in scripts committed to the
  repository; use environment injection or an interactive prompt.
