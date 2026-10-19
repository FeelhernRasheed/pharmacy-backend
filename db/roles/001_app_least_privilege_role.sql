-- ============================================================================
-- Review-only script: least-privilege application database role
-- ============================================================================
-- STATUS: NOT APPLIED. Waiting for explicit approval before execution.
--
-- WHY: The application currently connects as the `postgres` superuser.
--      A compromised app process would then own the entire cluster
--      (able to read other databases, create roles, or write files via
--      COPY). This script creates a dedicated `pharmacy_app` role limited
--      to exactly what the API needs: read/write on the 17 application
--      tables and their sequences — nothing else.
--
-- SAFETY:
--   * This script does NOT change, drop, or reassign the `postgres`
--     user and does NOT modify any table data.
--   * The password below is a PLACEHOLDER. Set the real password
--     interactively so plaintext never lands in a file, shell history,
--     or log:
--
--       psql -h localhost -U postgres -d Pharmacy-db
--       => \password pharmacy_app
--
--     or, from a shell (avoids echoing the secret):
--
--       $env:PGPASSWORD = '<generated-strong-secret>'
--       psql -h localhost -U postgres -d Pharmacy-db -c "ALTER ROLE pharmacy_app WITH PASSWORD '$env:PGPASSWORD';"
--
--   * After applying and verifying the app works with `pharmacy_app`,
--     update DB_USER / DB_PASSWORD in the deployment environment and
--     restart the application. Do NOT remove postgres access until the
--     application is confirmed healthy on the new role.
--
-- ROLLBACK:
--   REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pharmacy_app;
--   REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM pharmacy_app;
--   REVOKE ALL PRIVILEGES ON SCHEMA public FROM pharmacy_app;
--   REVOKE CONNECT ON DATABASE "Pharmacy-db" FROM pharmacy_app;
--   DROP ROLE IF EXISTS pharmacy_app;
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'pharmacy_app'
  ) THEN
    CREATE ROLE pharmacy_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
      NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- Schema usage (tables live in public)
GRANT USAGE ON SCHEMA public TO pharmacy_app;

-- Data access only: no DDL, no role management
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO pharmacy_app;

-- Sequence access needed for serial/bigserial primary keys
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pharmacy_app;

-- Future tables created by an admin inherit the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pharmacy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pharmacy_app;

-- The app only ever connects to this one database
REVOKE CREATE ON SCHEMA public FROM pharmacy_app;
