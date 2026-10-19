-- ============================================================================
-- Review-only migration: supporting indexes for FOREIGN KEY columns
-- ============================================================================
-- STATUS: NOT APPLIED. Generated during Phase 2 (database reliability) and
--         waiting for explicit approval before execution against any
--         database.
--
-- WHY: The database has 21 foreign keys but only 2 non-PK indexes. Every
--      FK column listed below is unindexed, which forces sequential scans
--      on DELETE/UPDATE of parent rows (referential-integrity checks) and
--      on child-side joins such as sale_items -> sale or
--      prescription_items -> prescription.
--
-- SAFETY:
--   * CREATE INDEX CONCURRENTLY builds the index without blocking reads
--     or writes, but it cannot run inside a transaction block. Run this
--     file with psql WITHOUT the -1/--single-transaction flag:
--
--       psql -h localhost -p 5432 -U postgres -d Pharmacy-db \
--            -v ON_ERROR_STOP=1 -f db/migrations/001_fk_indexes.sql
--
--   * Each index is independent; if one statement fails, the ones before
--     it remain valid. Re-running the file is safe (IF NOT EXISTS).
--   * Expect a brief lock at the very end of each CONCURRENTLY build
--     (share-update-exclusive). On this dataset (hundreds of rows) the
--     whole script should finish in seconds.
--   * No data is modified. No constraints are dropped or changed.
--
-- ROLLBACK:
--   psql ... -c "DROP INDEX CONCURRENTLY IF EXISTS idx_<table>_<column>;"
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispensing_items_batch_id
  ON dispensing_items (batch_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispensing_items_dispensing_id
  ON dispensing_items (dispensing_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispensing_items_prescription_item_id
  ON dispensing_items (prescription_item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispensings_dispensed_by
  ON dispensings (dispensed_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispensings_prescription_id
  ON dispensings (prescription_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_category_id
  ON medicines (category_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_sale_id
  ON payments (sale_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescription_items_medicine_id
  ON prescription_items (medicine_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescription_items_prescription_id
  ON prescription_items (prescription_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_patient_id
  ON prescriptions (patient_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_prescribed_by
  ON prescriptions (prescribed_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_medicine_id
  ON purchase_items (medicine_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_purchase_id
  ON purchase_items (purchase_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_supplier_id
  ON purchases (supplier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_batch_id
  ON sale_items (batch_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items (sale_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_patient_id
  ON sales (patient_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_adjustments_adjusted_by
  ON stock_adjustments (adjusted_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_adjustments_batch_id
  ON stock_adjustments (batch_id);
