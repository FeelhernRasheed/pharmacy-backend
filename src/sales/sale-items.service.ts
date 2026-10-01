import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';

@Injectable()
export class SaleItemsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getSaleItems(saleId: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           si.id,
           si.sale_id,
           si.batch_id,
           m.id AS medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.batch_number,
           mb.expiry_date,
           si.quantity,
           si.unit_price,
           si.subtotal
         FROM sale_items si
         INNER JOIN medicine_batches mb
           ON si.batch_id = mb.id
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         WHERE si.sale_id = $1
         ORDER BY si.id ASC`,
        [saleId],
      );

    return result.rows;
  }

  async createSaleItem(
    createSaleItemDto: CreateSaleItemDto,
  ) {
    const {
      sale_id,
      batch_id,
      quantity,
      unit_price,
    } = createSaleItemDto;

    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sale = await client.query(
        'SELECT id FROM sales WHERE id = $1',
        [sale_id],
      );

      if (sale.rows.length === 0) {
        throw new NotFoundException('Sale not found');
      }

      const batch = await client.query(
        `SELECT
           id,
           quantity,
           selling_price
         FROM medicine_batches
         WHERE id = $1
         FOR UPDATE`,
        [batch_id],
      );

      if (batch.rows.length === 0) {
        throw new NotFoundException('Medicine batch not found');
      }

      const availableQuantity = Number(
        batch.rows[0].quantity,
      );

      if (quantity > availableQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available quantity: ${availableQuantity}`,
        );
      }

      const subtotal = quantity * unit_price;

      const result = await client.query(
        `INSERT INTO sale_items
         (
           sale_id,
           batch_id,
           quantity,
           unit_price,
           subtotal
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          sale_id,
          batch_id,
          quantity,
          unit_price,
          subtotal,
        ],
      );

      await client.query(
        `UPDATE medicine_batches
         SET quantity = quantity - $1
         WHERE id = $2`,
        [quantity, batch_id],
      );

      await client.query(
        `UPDATE sales
         SET total_amount = (
           SELECT COALESCE(SUM(subtotal), 0)
           FROM sale_items
           WHERE sale_id = $1
         )
         WHERE id = $1`,
        [sale_id],
      );

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}