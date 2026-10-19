import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

function isUniqueViolation(error: any): boolean {
  return error?.code === '23505';
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getBatches() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           b.id,
           b.medicine_id,
           m.name AS medicine_name,
           m.strength,
           b.batch_number,
           b.expiry_date,
           b.quantity,
           b.buying_price,
           b.selling_price,
           b.created_at
         FROM medicine_batches b
         INNER JOIN medicines m
           ON b.medicine_id = m.id
         ORDER BY b.id ASC`,
      );

    return result.rows;
  }

  async getBatchById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           b.id,
           b.medicine_id,
           m.name AS medicine_name,
           m.strength,
           b.batch_number,
           b.expiry_date,
           b.quantity,
           b.buying_price,
           b.selling_price,
           b.created_at
         FROM medicine_batches b
         INNER JOIN medicines m
           ON b.medicine_id = m.id
         WHERE b.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Batch not found');
    }

    return result.rows[0];
  }

  async createBatch(
    createBatchDto: CreateBatchDto,
    actorUserId: number,
  ) {
    const {
      medicine_id,
      batch_number,
      expiry_date,
      quantity,
      buying_price,
      selling_price,
    } = createBatchDto;

    const medicine = await this.databaseService
      .getPool()
      .query(
        'SELECT id FROM medicines WHERE id = $1',
        [medicine_id],
      );

    if (medicine.rows.length === 0) {
      throw new NotFoundException(
        'Medicine not found',
      );
    }

    const expiryDate = String(expiry_date).slice(0, 10);

    const todayResult = await this.databaseService
      .getPool()
      .query(`SELECT CURRENT_DATE::text AS today`);

    const today = todayResult.rows[0].today as string;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      throw new BadRequestException(
        'expiry_date must be a valid date',
      );
    }

    if (expiryDate < today) {
      throw new BadRequestException(
        'Cannot create a batch with an expiry date in the past',
      );
    }

    let result;

    try {
      result = await this.databaseService
        .getPool()
        .query(
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
         RETURNING *`,
          [
            medicine_id,
            batch_number,
            expiry_date,
            quantity,
            buying_price,
            selling_price,
          ],
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A batch with number "${batch_number}" already exists for this medicine`,
        );
      }
      throw error;
    }

    const createdBatch = result.rows[0];

    await this.auditLogsService.createAuditLog(
      actorUserId,
      'CREATE',
      'INVENTORY',
      createdBatch.id,
      `Created inventory batch: ${createdBatch.batch_number}`,
    );

    return createdBatch;
  }

  async updateBatch(
    id: number,
    updateBatchDto: UpdateBatchDto,
    actorUserId: number,
  ) {
    const {
      batch_number,
      expiry_date,
      quantity,
      buying_price,
      selling_price,
    } = updateBatchDto;

    const existing = await this.databaseService
      .getPool()
      .query(
        'SELECT id, batch_number, quantity FROM medicine_batches WHERE id = $1',
        [id],
      );

    if (existing.rows.length === 0) {
      throw new NotFoundException(
        'Batch not found',
      );
    }

    const previousQuantity = Number(
      existing.rows[0].quantity,
    );

    let result;

    try {
      result = await this.databaseService
        .getPool()
        .query(
          `UPDATE medicine_batches
         SET batch_number = COALESCE($1, batch_number),
             expiry_date = COALESCE($2, expiry_date),
             quantity = COALESCE($3, quantity),
             buying_price = COALESCE($4, buying_price),
             selling_price = COALESCE($5, selling_price)
         WHERE id = $6
         RETURNING *`,
          [
            batch_number ?? null,
            expiry_date ?? null,
            quantity ?? null,
            buying_price ?? null,
            selling_price ?? null,
            id,
          ],
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A batch with number "${batch_number}" already exists for this medicine`,
        );
      }
      throw error;
    }

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'Batch not found',
      );
    }

    const updatedBatch = result.rows[0];
    const newQuantity = Number(updatedBatch.quantity);

    const quantityDetail =
      newQuantity !== previousQuantity
        ? ` (quantity ${previousQuantity} -> ${newQuantity})`
        : '';

    await this.auditLogsService.createAuditLog(
      actorUserId,
      'UPDATE',
      'INVENTORY',
      updatedBatch.id,
      `Updated inventory batch: ${updatedBatch.batch_number}${quantityDetail}`,
    );

    return updatedBatch;
  }

  async deleteBatch(
    id: number,
    actorUserId: number,
  ) {
    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    let deletedBatch: Record<string, any>;

    try {
      await client.query('BEGIN');

      const batchResult = await client.query(
        'SELECT * FROM medicine_batches WHERE id = $1 FOR UPDATE',
        [id],
      );

      if (batchResult.rows.length === 0) {
        throw new NotFoundException(
          'Batch not found',
        );
      }

      const batch = batchResult.rows[0];

      if (Number(batch.quantity) > 0) {
        throw new BadRequestException(
          `Cannot delete a batch with remaining stock (${batch.quantity}). Set the quantity to 0 using a stock adjustment first.`,
        );
      }

      const references =
        await client.query(
          `SELECT
             (SELECT COUNT(*) FROM sale_items WHERE batch_id = $1) AS sale_items,
             (SELECT COUNT(*) FROM dispensing_items WHERE batch_id = $1) AS dispensing_items,
             (SELECT COUNT(*) FROM stock_adjustments WHERE batch_id = $1) AS stock_adjustments`,
          [id],
        );

      const ref = references.rows[0];

      const totalReferences =
        Number(ref.sale_items) +
        Number(ref.dispensing_items) +
        Number(ref.stock_adjustments);

      if (totalReferences > 0) {
        throw new ConflictException(
          'Cannot delete a batch that is referenced by sales, dispensing records, or stock adjustments',
        );
      }

      const deleteResult = await client.query(
        'DELETE FROM medicine_batches WHERE id = $1 RETURNING *',
        [id],
      );

      deletedBatch = deleteResult.rows[0];

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await this.auditLogsService.createAuditLog(
      actorUserId,
      'DELETE',
      'INVENTORY',
      deletedBatch.id,
      `Deleted inventory batch: ${deletedBatch.batch_number}`,
    );

    return {
      message: 'Batch deleted successfully',
      batch: deletedBatch,
    };
  }
}