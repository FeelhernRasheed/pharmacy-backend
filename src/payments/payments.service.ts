import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getPayments() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.sale_id,
           p.amount,
           p.payment_method,
           p.payment_date,
           p.status,
           p.created_at
         FROM payments p
         ORDER BY p.id ASC`,
      );

    return result.rows;
  }

  async getPaymentById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.sale_id,
           p.amount,
           p.payment_method,
           p.payment_date,
           p.status,
           p.created_at
         FROM payments p
         WHERE p.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    return result.rows[0];
  }

  async getPaymentsBySaleId(saleId: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.sale_id,
           p.amount,
           p.payment_method,
           p.payment_date,
           p.status,
           p.created_at
         FROM payments p
         WHERE p.sale_id = $1
         ORDER BY p.id ASC`,
        [saleId],
      );

    return result.rows;
  }

  async createPayment(
    createPaymentDto: CreatePaymentDto,
    actorUserId?: number,
  ) {
    const {
      sale_id,
      amount,
      payment_method,
    } = createPaymentDto;

    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    let createdPayment: Record<string, any>;

    try {
      await client.query('BEGIN');

      const sale = await client.query(
        `SELECT
           id,
           total_amount,
           status
         FROM sales
         WHERE id = $1
         FOR UPDATE`,
        [sale_id],
      );

      if (sale.rows.length === 0) {
        throw new NotFoundException('Sale not found');
      }

      if (sale.rows[0].status === 'CANCELLED') {
        throw new BadRequestException(
          'Cannot record a payment for a cancelled sale',
        );
      }

      const totalAmount = Number(
        sale.rows[0].total_amount,
      );

      const payments = await client.query(
        `SELECT
           COALESCE(SUM(amount), 0) AS paid_amount
         FROM payments
         WHERE sale_id = $1
           AND status = 'COMPLETED'`,
        [sale_id],
      );

      const paidAmount = Number(
        payments.rows[0].paid_amount,
      );

      const remainingAmount = totalAmount - paidAmount;

      if (amount > remainingAmount) {
        throw new BadRequestException(
          `Payment exceeds remaining balance. Remaining amount: ${remainingAmount.toFixed(2)}`,
        );
      }

      const result = await client.query(
        `INSERT INTO payments
         (
           sale_id,
           amount,
           payment_method
         )
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          sale_id,
          amount,
          payment_method,
        ],
      );

      createdPayment = result.rows[0];

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'CREATE',
        'PAYMENTS',
        createdPayment.id,
        `Created payment: ${createdPayment.id} for sale: ${sale_id}`,
      );
    }

    return createdPayment;
  }

  async getPaymentsByStatus(status: string) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.sale_id,
           p.amount,
           p.payment_method,
           p.payment_date,
           p.status,
           p.created_at
         FROM payments p
         WHERE p.status = $1
         ORDER BY p.id ASC`,
        [status],
      );

    return result.rows;
  }
}