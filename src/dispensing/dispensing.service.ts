import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { CreateDispensingDto } from './dto/create-dispensing.dto';
import { CreateDispensingItemDto } from './dto/create-dispensing-item.dto';

@Injectable()
export class DispensingService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getDispensings() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           d.id,
           d.prescription_id,
           p.patient_id,
           pt.full_name AS patient_name,
           d.dispensed_by,
           u.full_name AS dispensed_by_name,
           d.dispensing_date,
           d.notes,
           d.status,
           d.created_at
         FROM dispensings d
         INNER JOIN prescriptions p
           ON d.prescription_id = p.id
         INNER JOIN patients pt
           ON p.patient_id = pt.id
         INNER JOIN users u
           ON d.dispensed_by = u.id
         ORDER BY d.id ASC`,
      );

    return result.rows;
  }

  async getDispensingById(id: number) {
    const dispensingResult = await this.databaseService
      .getPool()
      .query(
        `SELECT
           d.id,
           d.prescription_id,
           p.patient_id,
           pt.full_name AS patient_name,
           d.dispensed_by,
           u.full_name AS dispensed_by_name,
           d.dispensing_date,
           d.notes,
           d.status,
           d.created_at
         FROM dispensings d
         INNER JOIN prescriptions p
           ON d.prescription_id = p.id
         INNER JOIN patients pt
           ON p.patient_id = pt.id
         INNER JOIN users u
           ON d.dispensed_by = u.id
         WHERE d.id = $1`,
        [id],
      );

    if (dispensingResult.rows.length === 0) {
      throw new NotFoundException(
        'Dispensing record not found',
      );
    }

    const itemsResult = await this.databaseService
      .getPool()
      .query(
        `SELECT
           di.id,
           di.dispensing_id,
           di.prescription_item_id,
           di.batch_id,
           di.quantity,
           pi.medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.batch_number
         FROM dispensing_items di
         INNER JOIN prescription_items pi
           ON di.prescription_item_id = pi.id
         INNER JOIN medicines m
           ON pi.medicine_id = m.id
         INNER JOIN medicine_batches mb
           ON di.batch_id = mb.id
         WHERE di.dispensing_id = $1
         ORDER BY di.id ASC`,
        [id],
      );

    return {
      ...dispensingResult.rows[0],
      items: itemsResult.rows,
    };
  }

  async createDispensing(
    createDispensingDto: CreateDispensingDto,
  ) {
    const {
      prescription_id,
      dispensed_by,
      notes,
      status,
    } = createDispensingDto;

    const prescriptionResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT id
           FROM prescriptions
           WHERE id = $1`,
          [prescription_id],
        );

    if (prescriptionResult.rows.length === 0) {
      throw new NotFoundException(
        'Prescription not found',
      );
    }

    const userResult = await this.databaseService
      .getPool()
      .query(
        `SELECT id
         FROM users
         WHERE id = $1`,
        [dispensed_by],
      );

    if (userResult.rows.length === 0) {
      throw new NotFoundException(
        'Dispensing user not found',
      );
    }

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO dispensings
         (
           prescription_id,
           dispensed_by,
           notes,
           status
         )
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           prescription_id,
           dispensed_by,
           dispensing_date,
           notes,
           status,
           created_at`,
        [
          prescription_id,
          dispensed_by,
          notes ?? null,
          status ?? 'COMPLETED',
        ],
      );

    return result.rows[0];
  }

  async createDispensingItem(
    createDispensingItemDto: CreateDispensingItemDto,
  ) {
    const {
      dispensing_id,
      prescription_item_id,
      batch_id,
      quantity,
    } = createDispensingItemDto;

    const pool = this.databaseService.getPool();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * 1. Get the dispensing record and lock it.
       */
      const dispensingResult = await client.query(
        `SELECT
           id,
           prescription_id
         FROM dispensings
         WHERE id = $1
         FOR UPDATE`,
        [dispensing_id],
      );

      if (dispensingResult.rows.length === 0) {
        throw new NotFoundException(
          'Dispensing record not found',
        );
      }

      const dispensing =
        dispensingResult.rows[0];

      /*
       * 2. Get the prescription item.
       */
      const prescriptionItemResult =
        await client.query(
          `SELECT
             id,
             prescription_id,
             medicine_id,
             quantity
           FROM prescription_items
           WHERE id = $1
           FOR UPDATE`,
          [prescription_item_id],
        );

      if (
        prescriptionItemResult.rows.length === 0
      ) {
        throw new NotFoundException(
          'Prescription item not found',
        );
      }

      const prescriptionItem =
        prescriptionItemResult.rows[0];

      /*
       * 3. Make sure the prescription item
       * belongs to the dispensing prescription.
       */
      if (
        prescriptionItem.prescription_id !==
        dispensing.prescription_id
      ) {
        throw new BadRequestException(
          'Prescription item does not belong to this dispensing prescription',
        );
      }

      /*
       * 4. Check how much of this prescription item
       * has already been dispensed.
       */
      const dispensedResult =
        await client.query(
          `SELECT
             COALESCE(SUM(quantity), 0) AS total_dispensed
           FROM dispensing_items
           WHERE prescription_item_id = $1`,
          [prescription_item_id],
        );

      const alreadyDispensed = Number(
        dispensedResult.rows[0].total_dispensed,
      );

      const remainingQuantity =
        prescriptionItem.quantity -
        alreadyDispensed;

      /*
       * 5. Prevent dispensing more than prescribed.
       */
      if (quantity > remainingQuantity) {
        throw new BadRequestException(
          `Dispensing quantity exceeds remaining prescription quantity. Remaining quantity: ${remainingQuantity}`,
        );
      }

      /*
       * 6. Lock the medicine batch.
       */
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

      /*
       * 7. Make sure the batch contains
       * the correct medicine.
       */
      if (
        batch.medicine_id !==
        prescriptionItem.medicine_id
      ) {
        throw new BadRequestException(
          'Medicine batch does not match prescription medicine',
        );
      }

      /*
       * 8. Check available stock.
       */
      if (quantity > batch.quantity) {
        throw new BadRequestException(
          `Insufficient stock in medicine batch. Available quantity: ${batch.quantity}`,
        );
      }

      /*
       * 9. Reduce inventory.
       */
      const updatedBatchResult =
        await client.query(
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

      /*
       * 10. Create dispensing item.
       */
      const dispensingItemResult =
        await client.query(
          `INSERT INTO dispensing_items
           (
             dispensing_id,
             prescription_item_id,
             batch_id,
             quantity
           )
           VALUES ($1, $2, $3, $4)
           RETURNING
             id,
             dispensing_id,
             prescription_item_id,
             batch_id,
             quantity,
             created_at`,
          [
            dispensing_id,
            prescription_item_id,
            batch_id,
            quantity,
          ],
        );

      /*
       * 11. Commit everything together.
       */
      await client.query('COMMIT');

      return {
        ...dispensingItemResult.rows[0],
        remaining_prescription_quantity:
          remainingQuantity - quantity,
        remaining_batch_quantity:
          updatedBatchResult.rows[0].quantity,
      };
    } catch (error) {
      /*
       * If anything fails, undo every database
       * operation performed in this transaction.
       */
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }
}