import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly databaseService: DatabaseService,
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

  async createBatch(createBatchDto: CreateBatchDto) {
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
      throw new NotFoundException('Medicine not found');
    }

    const result = await this.databaseService
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

    return result.rows[0];
  }

  async updateBatch(
    id: number,
    updateBatchDto: UpdateBatchDto,
  ) {
    const {
      batch_number,
      expiry_date,
      quantity,
      buying_price,
      selling_price,
    } = updateBatchDto;

    const result = await this.databaseService
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

    if (result.rows.length === 0) {
      throw new NotFoundException('Batch not found');
    }

    return result.rows[0];
  }

  async deleteBatch(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        'DELETE FROM medicine_batches WHERE id = $1 RETURNING *',
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Batch not found');
    }

    return {
      message: 'Batch deleted successfully',
      batch: result.rows[0],
    };
  }
}