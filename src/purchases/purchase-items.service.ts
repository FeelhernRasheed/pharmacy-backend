import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';

@Injectable()
export class PurchaseItemsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getPurchaseItems(purchaseId: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           pi.id,
           pi.purchase_id,
           pi.medicine_id,
           m.name AS medicine_name,
           m.strength,
           pi.batch_number,
           pi.expiry_date,
           pi.quantity,
           pi.buying_price,
           pi.selling_price,
           pi.subtotal
         FROM purchase_items pi
         INNER JOIN medicines m
           ON pi.medicine_id = m.id
         WHERE pi.purchase_id = $1
         ORDER BY pi.id ASC`,
        [purchaseId],
      );

    return result.rows;
  }

  async createPurchaseItem(
    createPurchaseItemDto: CreatePurchaseItemDto,
  ) {
    const {
      purchase_id,
      medicine_id,
      batch_number,
      expiry_date,
      quantity,
      buying_price,
      selling_price,
    } = createPurchaseItemDto;

    const pool = this.databaseService.getPool();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const purchase = await client.query(
        'SELECT id FROM purchases WHERE id = $1',
        [purchase_id],
      );

      if (purchase.rows.length === 0) {
        throw new NotFoundException('Purchase not found');
      }

      const medicine = await client.query(
        'SELECT id FROM medicines WHERE id = $1',
        [medicine_id],
      );

      if (medicine.rows.length === 0) {
        throw new NotFoundException('Medicine not found');
      }

      const subtotal = quantity * buying_price;

      const result = await client.query(
        `INSERT INTO purchase_items
         (
           purchase_id,
           medicine_id,
           batch_number,
           expiry_date,
           quantity,
           buying_price,
           selling_price,
           subtotal
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          purchase_id,
          medicine_id,
          batch_number,
          expiry_date,
          quantity,
          buying_price,
          selling_price,
          subtotal,
        ],
      );

      await client.query(
        `INSERT INTO medicine_batches
         (
           medicine_id,
           batch_number,
           expiry_date,
           quantity,
           buying_price,
           selling_price
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (medicine_id, batch_number)
         DO UPDATE SET
           quantity = medicine_batches.quantity + EXCLUDED.quantity,
           expiry_date = EXCLUDED.expiry_date,
           buying_price = EXCLUDED.buying_price,
           selling_price = EXCLUDED.selling_price`,
        [
          medicine_id,
          batch_number,
          expiry_date,
          quantity,
          buying_price,
          selling_price,
        ],
      );

      await client.query(
        `UPDATE purchases
         SET total_amount = (
           SELECT COALESCE(SUM(subtotal), 0)
           FROM purchase_items
           WHERE purchase_id = $1
         )
         WHERE id = $1`,
        [purchase_id],
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