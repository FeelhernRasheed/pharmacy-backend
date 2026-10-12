
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  // 1. Sales Report
  async getSalesReport() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           COUNT(*) AS total_transactions,
           COALESCE(
             SUM(total_amount) FILTER (
               WHERE status = 'COMPLETED'
             ),
             0
           ) AS total_sales,
           COALESCE(
             AVG(total_amount) FILTER (
               WHERE status = 'COMPLETED'
             ),
             0
           ) AS average_sale,
           COUNT(*) FILTER (
             WHERE status = 'COMPLETED'
           ) AS completed_transactions,
           COUNT(*) FILTER (
             WHERE status = 'CANCELLED'
           ) AS cancelled_transactions
         FROM sales`,
      );

    return result.rows[0];
  }

  // 2. Inventory Report
  async getInventoryReport() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id AS batch_id,
           m.name AS medicine_name,
           m.strength,
           mb.batch_number,
           mb.expiry_date,
           mb.quantity,
           mb.buying_price,
           mb.selling_price,
           (mb.quantity * mb.buying_price) AS stock_value
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON m.id = mb.medicine_id
         ORDER BY m.name ASC, mb.expiry_date ASC`,
      );

    return result.rows;
  }

  // 3. Expiry Report
  async getExpiryReport() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id AS batch_id,
           m.name AS medicine_name,
           m.strength,
           mb.batch_number,
           mb.expiry_date,
           mb.quantity,
           CASE
             WHEN mb.expiry_date < CURRENT_DATE
               THEN 'EXPIRED'
             WHEN mb.expiry_date <= CURRENT_DATE + 90
               THEN 'EXPIRING_SOON'
             ELSE 'VALID'
           END AS expiry_status
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON m.id = mb.medicine_id
         ORDER BY mb.expiry_date ASC`,
      );

    return result.rows;
  }

  // 4. Purchases Report
  async getPurchasesReport() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id AS purchase_id,
           s.name AS supplier_name,
           p.invoice_number,
           p.purchase_date,
           p.total_amount,
           p.status
         FROM purchases p
         INNER JOIN suppliers s
           ON s.id = p.supplier_id
         ORDER BY p.purchase_date DESC`,
      );

    return result.rows;
  }

  // 5. Payments Report
  async getPaymentsReport() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           payment_method,
           status,
           COUNT(*) AS payment_count,
           COALESCE(SUM(amount), 0) AS total_amount
         FROM payments
         GROUP BY payment_method, status
         ORDER BY payment_method ASC, status ASC`,
      );

    return result.rows;
  }
}
