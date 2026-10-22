import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';

// Amounts are stored as numeric(10,2); comparing them as IEEE floats
// can report a false mismatch. Prices are therefore compared in
// integer cents.
function toCents(value: number): number {
  return Math.round(value * 100);
}

@Injectable()
export class SaleItemsService {
  private readonly logger = new Logger(
    SaleItemsService.name,
  );

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
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
    actorUserId?: number,
    executor?: PoolClient,
  ) {
    const {
      sale_id,
      batch_id,
      quantity,
      unit_price: requestedUnitPrice,
    } = createSaleItemDto;

    return this.databaseService.runInTransaction(
      async (client) => {
        const sale = await client.query(
          'SELECT id, status FROM sales WHERE id = $1 FOR UPDATE',
          [sale_id],
        );

        if (sale.rows.length === 0) {
          throw new NotFoundException('Sale not found');
        }

        if (sale.rows[0].status === 'CANCELLED') {
          throw new BadRequestException(
            'Cannot add items to a cancelled sale',
          );
        }

        const batch = await client.query(
          `SELECT
             id,
             quantity,
             selling_price,
             expiry_date::text AS expiry_date
           FROM medicine_batches
           WHERE id = $1
           FOR UPDATE`,
          [batch_id],
        );

        if (batch.rows.length === 0) {
          throw new NotFoundException('Medicine batch not found');
        }

        const expiryDate = String(
          batch.rows[0].expiry_date ?? '',
        ).slice(0, 10);

        const todayResult = await client.query(
          `SELECT CURRENT_DATE::text AS today`,
        );

        const today = todayResult.rows[0].today as string;

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
          expiryDate < today
        ) {
          throw new BadRequestException(
            'Cannot sell expired medicine',
          );
        }

        const availableQuantity = Number(
          batch.rows[0].quantity,
        );

        if (quantity > availableQuantity) {
          throw new BadRequestException(
            `Insufficient stock. Available quantity: ${availableQuantity}`,
          );
        }

        // The server is the only authority for the unit price: the
        // price of the locked batch row is used, a price sent by the
        // client is never trusted. The subtotal is calculated by the
        // database from that same price so it cannot be manipulated
        // through rounding.
        const authoritativeUnitPrice = batch.rows[0].selling_price;

        const priceMismatch =
          requestedUnitPrice !== undefined &&
          toCents(requestedUnitPrice) !==
            toCents(Number(authoritativeUnitPrice));

        if (priceMismatch) {
          this.logger.warn(
            `Ignored client supplied unit_price ${requestedUnitPrice} for batch ${batch_id}; applied server price ${authoritativeUnitPrice}`,
          );
        }

        const result = await client.query(
          `INSERT INTO sale_items
           (
             sale_id,
             batch_id,
             quantity,
             unit_price,
             subtotal
           )
           VALUES ($1, $2, $3, $4::numeric, $4::numeric * $3::int)
           RETURNING *`,
          [
            sale_id,
            batch_id,
            quantity,
            authoritativeUnitPrice,
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

        const createdItem = result.rows[0];

        const priceDetail = priceMismatch
          ? ` (client requested unit_price: ${requestedUnitPrice}, applied server price: ${authoritativeUnitPrice})`
          : '';

        if (actorUserId) {
          await this.auditLogsService.createAuditLog(
            actorUserId,
            'CREATE',
            'SALE_ITEMS',
            createdItem.id,
            `Created sale item: ${createdItem.id} for sale: ${sale_id}${priceDetail}`,
            client,
          );
        }

        return createdItem;
      },
      executor,
    );
  }
}
