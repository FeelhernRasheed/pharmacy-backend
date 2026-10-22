import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getStockAdjustments() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           sa.id,
           sa.batch_id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           sa.adjustment_type,
           sa.quantity,
           sa.reason,
           sa.adjusted_by,
           u.full_name AS adjusted_by_name,
           sa.adjustment_date,
           sa.created_at
         FROM stock_adjustments sa
         INNER JOIN medicine_batches mb
           ON sa.batch_id = mb.id
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         INNER JOIN users u
           ON sa.adjusted_by = u.id
         ORDER BY sa.id ASC`,
      );

    return result.rows;
  }

  async getStockAdjustmentById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           sa.id,
           sa.batch_id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           sa.adjustment_type,
           sa.quantity,
           sa.reason,
           sa.adjusted_by,
           u.full_name AS adjusted_by_name,
           sa.adjustment_date,
           sa.created_at
         FROM stock_adjustments sa
         INNER JOIN medicine_batches mb
           ON sa.batch_id = mb.id
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         INNER JOIN users u
           ON sa.adjusted_by = u.id
         WHERE sa.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'Stock adjustment not found',
      );
    }

    return result.rows[0];
  }

  async createStockAdjustment(
    createStockAdjustmentDto: CreateStockAdjustmentDto,
    actorUserId?: number,
  ) {
    const {
      batch_id,
      adjustment_type,
      quantity,
      reason,
    } = createStockAdjustmentDto;

    if (!actorUserId) {
      throw new NotFoundException(
        'Authenticated user not found',
      );
    }

    return this.databaseService.runInTransaction(
      async (client) => {
        // 1. Lock the batch row.
        const batchResult = await client.query(
          `SELECT
             id,
             medicine_id,
             batch_number,
             quantity,
             expiry_date
           FROM medicine_batches
           WHERE id = $1
           FOR UPDATE`,
          [batch_id],
        );

        if (batchResult.rows.length === 0) {
          throw new NotFoundException(
            'Medicine batch not found',
          );
        }

        const batch = batchResult.rows[0];

        // 2. Check the authenticated user exists.
        const userResult = await client.query(
          `SELECT
             id,
             full_name,
             role,
             status
           FROM users
           WHERE id = $1`,
          [actorUserId],
        );

        if (userResult.rows.length === 0) {
          throw new NotFoundException(
            'Adjustment user not found',
          );
        }

        const user = userResult.rows[0];

        // 3. Only active users can make adjustments.
        if (user.status !== 'ACTIVE') {
          throw new BadRequestException(
            'Adjustment user account is not active',
          );
        }

        // 4. Prevent removing more stock than exists.
        if (quantity > batch.quantity) {
          throw new BadRequestException(
            `Adjustment quantity exceeds available stock. Available quantity: ${batch.quantity}`,
          );
        }

        // 5. Reduce the batch quantity.
        const updatedBatchResult = await client.query(
          `UPDATE medicine_batches
           SET quantity = quantity - $1
           WHERE id = $2
           RETURNING
             id,
             medicine_id,
             batch_number,
             quantity,
             expiry_date`,
          [quantity, batch_id],
        );

        // 6. Record the adjustment.
        const adjustmentResult = await client.query(
          `INSERT INTO stock_adjustments
           (
             batch_id,
             adjustment_type,
             quantity,
             reason,
             adjusted_by
           )
           VALUES ($1, $2, $3, $4, $5)
           RETURNING
             id,
             batch_id,
             adjustment_type,
             quantity,
             reason,
             adjusted_by,
             adjustment_date,
             created_at`,
          [
            batch_id,
            adjustment_type,
            quantity,
            reason,
            actorUserId,
          ],
        );

        const createdAdjustment =
          adjustmentResult.rows[0];

        // 7. The audit log belongs to the same transaction as the
        //    stock change: either both are persisted or neither is.
        await this.auditLogsService.createAuditLog(
          actorUserId,
          'CREATE',
          'STOCK_ADJUSTMENTS',
          createdAdjustment.id,
          `Created stock adjustment: ${createdAdjustment.id} for batch: ${batch_id}`,
          client,
        );

        return {
          ...createdAdjustment,
          remaining_batch_quantity:
            updatedBatchResult.rows[0].quantity,
        };
      },
    );
  }
}
