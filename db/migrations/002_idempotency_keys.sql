-- ============================================================================
-- Migration: durable idempotency keys for retried POST requests
-- ============================================================================
-- STATUS: applied to pharmacy_test only (explicit approval). The
--         Pharmacy-db instance is NOT migrated by this script.
--
-- WHY: POST /sales, POST /sale-items and POST /payments are money
--      operations. A client that retries such a request (network
--      timeout, double click, proxy retry) currently creates a second
--      sale, a second stock deduction or a second payment. The
--      idempotency_keys table lets the API recognise a repeated
--      request and replay the original response instead of executing
--      the business change twice.
--
-- HOW IT WORKS: the key row and the business change are written in the
--      same transaction:
--        * INSERT ... ON CONFLICT DO NOTHING claims the key;
--        * a conflict means the request is a repeat -> the stored
--          response is replayed and no business change happens;
--        * a failed request rolls the transaction back, so the key is
--          released and the caller may retry with the same key.
--
-- SAFETY:
--   * The table is additive: no existing table is altered and no data
--     is modified.
--   * CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS make the
--     script re-runnable.
--   * The table is written by the API only; rows are never read or
--     deleted by the application. Rows accumulate over time; a
--     retention job (DELETE FROM idempotency_keys WHERE created_at <
--     now() - interval '30 days') can be added later.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS idempotency_keys;
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  endpoint        TEXT        NOT NULL,
  idempotency_key TEXT        NOT NULL,
  status_code     INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idempotency_keys_pkey
    PRIMARY KEY (endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys (created_at);
