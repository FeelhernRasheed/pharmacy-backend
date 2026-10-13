
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDispensingDto } from './dto/create-dispensing.dto';
import { CreateDispensingItemDto } from './dto/create-dispensing-item.dto';

@Injectable()
export class DispensingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getDispensings() {
    const pool = this.databaseService.getPool();

    const result = await pool.query(`
      SELECT
        d.*,
        p.patient_id,
        p.status AS prescription_status
      FROM dispensings d
      JOIN prescriptions p ON p.id = d.prescription_id
      ORDER BY d.id DESC
    `);

    return result.rows;
  }

  async getDispensingById(id: number) {
    const pool = this.databaseService.getPool();

    const dispensingResult = await pool.query(
      `
        SELECT
          d.*,
          p.patient_id,
          p.status AS prescription_status
        FROM dispensings d
        JOIN prescriptions p ON p.id = d.prescription_id
        WHERE d.id = $1
      `,
      [id],
    );

    if (dispensingResult.rows.length === 0) {
      throw new NotFoundException('Dispensing record not found');
    }

    const itemsResult = await pool.query(
      `
        SELECT
          di.*,
          pi.medicine_id,
          pi.quantity AS prescribed_quantity,
          mb.batch_number,
          m.name AS medicine_name,
          m.strength AS medicine_strength
        FROM dispensing_items di
        JOIN prescription_items pi
          ON pi.id = di.prescription_item_id
        JOIN medicine_batches mb
          ON mb.id = di.batch_id
        JOIN medicines m
          ON m.id = pi.medicine_id
        WHERE di.dispensing_id = $1
        ORDER BY di.id
      `,
      [id],
    );

    return {
      ...dispensingResult.rows[0],
      items: itemsResult.rows,
    };
  }

  async createDispensing(
    createDispensingDto: CreateDispensingDto,
    actorUserId?: number,
  ) {
    const pool = this.databaseService.getPool();

    const {
      prescription_id,
      notes,
      status,
    } = createDispensingDto;

    const prescriptionResult = await pool.query(
      `
        SELECT id
        FROM prescriptions
        WHERE id = $1
      `,
      [prescription_id],
    );

    if (prescriptionResult.rows.length === 0) {
      throw new NotFoundException('Prescription not found');
    }

    const result = await pool.query(
      `
        INSERT INTO dispensings (
          prescription_id,
          dispensed_by,
          notes,
          status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        prescription_id,
        actorUserId ?? null,
        notes ?? null,
        status ?? 'PENDING',
      ],
    );

    const createdDispensing = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'CREATE',
        'DISPENSINGS',
        createdDispensing.id,
        `Created dispensing: ${createdDispensing.id} for prescription: ${prescription_id}`,
      );
    }

    return createdDispensing;
  }

  async createDispensingItem(
    createDispensingItemDto: CreateDispensingItemDto,
    actorUserId?: number,
  ) {
    const {
      dispensing_id,
      prescription_item_id,
      batch_id,
      quantity,
    } = createDispensingItemDto;

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException(
        'quantity must not be less than 1',
      );
    }

    if (!actorUserId) {
      throw new BadRequestException(
        'Authenticated user is required to dispense medicine',
      );
    }

    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    let createdItem: Record<string, any>;
    let remainingPrescriptionQuantity = 0;
    let remainingBatchQuantity = 0;
    let prescriptionStatus = 'PENDING';

    try {
      await client.query('BEGIN');

      // 1. Lock the dispensing record.
      const dispensingResult = await client.query(
        `
          SELECT id, prescription_id
          FROM dispensings
          WHERE id = $1
          FOR UPDATE
        `,
        [dispensing_id],
      );

      if (dispensingResult.rows.length === 0) {
        throw new NotFoundException('Dispensing record not found');
      }

      const dispensing = dispensingResult.rows[0];

      // 2. Lock the prescription item.
      const prescriptionItemResult = await client.query(
        `
          SELECT
            id,
            prescription_id,
            medicine_id,
            quantity
          FROM prescription_items
          WHERE id = $1
          FOR UPDATE
        `,
        [prescription_item_id],
      );

      if (prescriptionItemResult.rows.length === 0) {
        throw new NotFoundException('Prescription item not found');
      }

      const prescriptionItem = prescriptionItemResult.rows[0];

      // 3. Ensure the prescription item belongs to this dispensing.
      if (
        Number(prescriptionItem.prescription_id) !==
        Number(dispensing.prescription_id)
      ) {
        throw new BadRequestException(
          'Prescription item does not belong to this dispensing prescription',
        );
      }

      // 4. Calculate how much has already been dispensed.
      const alreadyDispensedResult = await client.query(
        `
          SELECT COALESCE(SUM(quantity), 0)::int AS total_dispensed
          FROM dispensing_items
          WHERE prescription_item_id = $1
        `,
        [prescription_item_id],
      );

      const alreadyDispensed = Number(
        alreadyDispensedResult.rows[0].total_dispensed,
      );

      const prescribedQuantity = Number(prescriptionItem.quantity);

      remainingPrescriptionQuantity =
        prescribedQuantity - alreadyDispensed;

      if (quantity > remainingPrescriptionQuantity) {
        throw new BadRequestException(
          `Cannot dispense ${quantity} units. Remaining prescription quantity is ${remainingPrescriptionQuantity}`,
        );
      }

      // 5. Lock the batch.
      // IMPORTANT: expiry_date::text prevents PostgreSQL DATE values
      // from being converted into JavaScript Date objects by pg.
      const batchResult = await client.query(
        `
          SELECT
            id,
            medicine_id,
            batch_number,
            quantity,
            expiry_date::text AS expiry_date
          FROM medicine_batches
          WHERE id = $1
          FOR UPDATE
        `,
        [batch_id],
      );

      if (batchResult.rows.length === 0) {
        throw new NotFoundException('Medicine batch not found');
      }

      const batch = batchResult.rows[0];

      // 6. Ensure the batch contains the prescribed medicine.
      if (
        Number(batch.medicine_id) !==
        Number(prescriptionItem.medicine_id)
      ) {
        throw new BadRequestException(
          'Selected batch does not belong to the prescribed medicine',
        );
      }

      // 7. Reject invalid or expired batches.
      const expiryDate = String(batch.expiry_date ?? '').slice(0, 10);

      const todayResult = await client.query(
        `SELECT CURRENT_DATE::text AS today`,
      );

      const today = todayResult.rows[0].today as string;

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
        expiryDate < today
      ) {
        throw new BadRequestException(
          'Cannot dispense expired medicine',
        );
      }

      // 8. Check available batch stock.
      const availableBatchQuantity = Number(batch.quantity);

      if (availableBatchQuantity < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available quantity is ${availableBatchQuantity}`,
        );
      }

      // 9. Deduct stock.
      const stockUpdateResult = await client.query(
        `
          UPDATE medicine_batches
          SET quantity = quantity - $1
          WHERE id = $2
          RETURNING quantity
        `,
        [quantity, batch_id],
      );

      remainingBatchQuantity = Number(
        stockUpdateResult.rows[0].quantity,
      );

      // 10. Create the dispensing item.
      const itemResult = await client.query(
        `
          INSERT INTO dispensing_items (
            dispensing_id,
            prescription_item_id,
            batch_id,
            quantity
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [
          dispensing_id,
          prescription_item_id,
          batch_id,
          quantity,
        ],
      );

      createdItem = itemResult.rows[0];

      // 11. Recalculate the prescription's overall dispensing status.
      const prescriptionTotalsResult = await client.query(
        `
          SELECT
            COALESCE(SUM(pi.quantity), 0)::int AS total_prescribed,
            COALESCE(
              (
                SELECT SUM(di.quantity)
                FROM dispensing_items di
                JOIN prescription_items pi2
                  ON pi2.id = di.prescription_item_id
                WHERE pi2.prescription_id = $1
              ),
              0
            )::int AS total_dispensed
          FROM prescription_items pi
          WHERE pi.prescription_id = $1
        `,
        [dispensing.prescription_id],
      );

      const totalPrescribed = Number(
        prescriptionTotalsResult.rows[0].total_prescribed,
      );

      const totalDispensed = Number(
        prescriptionTotalsResult.rows[0].total_dispensed,
      );

      if (totalDispensed <= 0) {
        prescriptionStatus = 'PENDING';
      } else if (totalDispensed < totalPrescribed) {
        prescriptionStatus = 'PARTIALLY_DISPENSED';
      } else {
        prescriptionStatus = 'COMPLETED';
      }

      await client.query(
        `
          UPDATE prescriptions
          SET status = $1
          WHERE id = $2
        `,
        [prescriptionStatus, dispensing.prescription_id],
      );

      // 12. Commit the stock deduction and item creation together.
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // 13. Write the audit log after the transaction commits.
    await this.auditLogsService.createAuditLog(
      actorUserId,
      'CREATE',
      'DISPENSING_ITEMS',
      createdItem.id,
      `Created dispensing item: ${createdItem.id} for dispensing: ${dispensing_id}`,
    );

    return {
      ...createdItem,
      remaining_prescription_quantity:
        remainingPrescriptionQuantity - quantity,
      remaining_batch_quantity: remainingBatchQuantity,
      prescription_status: prescriptionStatus,
    };
  }
}
