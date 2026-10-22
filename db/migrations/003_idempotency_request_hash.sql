-- ============================================================================
-- Migration: request fingerprint for idempotency keys
-- ============================================================================
-- STATUS: applied to pharmacy_test only (explicit approval, test
--         database). The Pharmacy-db instance is NOT migrated by this
--         script - that requires separate explicit approval.
--
-- WHY: an idempotency key only protects a request when it is used for
--      the same request. Without a fingerprint a client that reuses a
--      key for a different payload silently receives the response of
--      the first request while its own business change is never
--      executed (no duplicate charge, but also no payment at all).
--      The request_hash column stores a fingerprint of the request the
--      key was used for, so the API can tell "same request" from "same
--      key, different request".
--
-- WHAT IS STORED: the SHA-256 fingerprint of
--      "<HTTP method>\n<endpoint>\n<canonical payload>"
--      where the canonical payload is the validated request DTO with
--      sorted object keys, dropped undefined properties and normalised
--      numbers. Equivalent payloads therefore produce an identical
--      fingerprint.
--
-- NULL SEMANTICS: rows written before this migration have no
--      fingerprint. The API cannot verify the payload of such a record
--      and replays the stored response without verification, which is
--      the behaviour these records were created with. Every record
--      written after this migration carries a fingerprint and is
--      verified strictly. Old records age out through the retention
--      job mentioned in 002_idempotency_keys.sql.
--
-- SAFETY:
--   * Additive and metadata only: a nullable column without a default
--     does not rewrite the table, so the statement is fast and takes
--     only a brief exclusive lock.
--   * ADD COLUMN IF NOT EXISTS makes the script re-runnable.
--   * No existing row is modified.
--
-- ROLLBACK:
--   ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS request_hash;
-- ============================================================================

ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

COMMENT ON COLUMN idempotency_keys.request_hash IS
  'SHA-256 fingerprint of the request (method, endpoint, canonical payload) the key was used for. NULL for records created before this migration; those are replayed without payload verification.';
