import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';

@Injectable()
export class PurchaseItemsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
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
    actorUserId?: number,
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

    return this.databaseService.runInTransaction(
      async (client) => {
        const purchase = await client.query(
          'SELECT id, status FROM purchases WHERE id = $1 FOR UPDATE',
          [purchase_id],
        );

        if (purchase.rows.length === 0) {
          throw new NotFoundException('Purchase not found');
        }

        if (purchase.rows[0].status === 'CANCELLED') {
          throw new BadRequestException(
            'Cannot add items to a cancelled purchase',
          );
        }

        const medicine = await client.query(
          'SELECT id FROM medicines WHERE id = $1',
          [medicine_id],
        );

        if (medicine.rows.length === 0) {
          throw new NotFoundException('Medicine not found');
        }

        const expiryDate = String(expiry_date).slice(0, 10);

        const todayResult = await client.query(
          `SELECT CURRENT_DATE::text AS today`,
        );

        const today = todayResult.rows[0].today as string;

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
          expiryDate < today
        ) {
          throw new BadRequestException(
            'Cannot receive a batch with an expiry date in the past',
          );
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

        const createdItem = result.rows[0];

        if (actorUserId) {
          await this.auditLogsService.createAuditLog(
            actorUserId,
            'CREATE',
            'PURCHASE_ITEMS',
            createdItem.id,
            `Created purchase item for batch ${batch_number}`,
            client,
          );
        }

        return createdItem;
      },
    );
  }
}
