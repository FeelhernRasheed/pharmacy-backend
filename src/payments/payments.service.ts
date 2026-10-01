import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly databaseService: DatabaseService,
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
  ) {
    const {
      sale_id,
      amount,
      payment_method,
    } = createPaymentDto;

    const pool = this.databaseService.getPool();

    const sale = await pool.query(
      `SELECT
         id,
         total_amount
       FROM sales
       WHERE id = $1`,
      [sale_id],
    );

    if (sale.rows.length === 0) {
      throw new NotFoundException('Sale not found');
    }

    const totalAmount = Number(
      sale.rows[0].total_amount,
    );

    const payments = await pool.query(
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

    const remainingAmount =
      totalAmount - paidAmount;

    if (amount > remainingAmount) {
      throw new BadRequestException(
        `Payment exceeds remaining balance. Remaining amount: ${remainingAmount.toFixed(2)}`,
      );
    }

    const result = await pool.query(
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

    return result.rows[0];
  }
}