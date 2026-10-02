import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionItemDto } from './dto/create-prescription-item.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getPrescriptions() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.patient_id,
           pt.full_name AS patient_name,
           p.prescribed_by,
           u.full_name AS prescribed_by_name,
           p.prescription_date,
           p.notes,
           p.status,
           p.created_at,
           p.updated_at
         FROM prescriptions p
         INNER JOIN patients pt
           ON p.patient_id = pt.id
         LEFT JOIN users u
           ON p.prescribed_by = u.id
         ORDER BY p.id ASC`,
      );

    return result.rows;
  }

  async getPrescriptionById(id: number) {
    const prescriptionResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT
             p.id,
             p.patient_id,
             pt.full_name AS patient_name,
             p.prescribed_by,
             u.full_name AS prescribed_by_name,
             p.prescription_date,
             p.notes,
             p.status,
             p.created_at,
             p.updated_at
           FROM prescriptions p
           INNER JOIN patients pt
             ON p.patient_id = pt.id
           LEFT JOIN users u
             ON p.prescribed_by = u.id
           WHERE p.id = $1`,
          [id],
        );

    if (prescriptionResult.rows.length === 0) {
      throw new NotFoundException(
        'Prescription not found',
      );
    }

    const itemsResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT
             pi.id,
             pi.prescription_id,
             pi.medicine_id,
             m.name AS medicine_name,
             m.strength,
             pi.dosage,
             pi.frequency,
             pi.duration,
             pi.quantity,
             pi.instructions,
             pi.created_at
           FROM prescription_items pi
           INNER JOIN medicines m
             ON pi.medicine_id = m.id
           WHERE pi.prescription_id = $1
           ORDER BY pi.id ASC`,
          [id],
        );

    return {
      ...prescriptionResult.rows[0],
      items: itemsResult.rows,
    };
  }

  async createPrescription(
    createPrescriptionDto: CreatePrescriptionDto,
  ) {
    const {
      patient_id,
      prescribed_by,
      notes,
      status,
    } = createPrescriptionDto;

    const patientResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT id
           FROM patients
           WHERE id = $1`,
          [patient_id],
        );

    if (patientResult.rows.length === 0) {
      throw new NotFoundException(
        'Patient not found',
      );
    }

    if (prescribed_by) {
      const userResult =
        await this.databaseService
          .getPool()
          .query(
            `SELECT id
             FROM users
             WHERE id = $1`,
            [prescribed_by],
          );

      if (userResult.rows.length === 0) {
        throw new NotFoundException(
          'Prescriber not found',
        );
      }
    }

    const result =
      await this.databaseService
        .getPool()
        .query(
          `INSERT INTO prescriptions
           (
             patient_id,
             prescribed_by,
             notes,
             status
           )
           VALUES ($1, $2, $3, $4)
           RETURNING
             id,
             patient_id,
             prescribed_by,
             prescription_date,
             notes,
             status,
             created_at,
             updated_at`,
          [
            patient_id,
            prescribed_by ?? null,
            notes ?? null,
            status ?? 'PENDING',
          ],
        );

    return result.rows[0];
  }

  async createPrescriptionItem(
    createPrescriptionItemDto: CreatePrescriptionItemDto,
  ) {
    const {
      prescription_id,
      medicine_id,
      dosage,
      frequency,
      duration,
      quantity,
      instructions,
    } = createPrescriptionItemDto;

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

    const medicineResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT id
           FROM medicines
           WHERE id = $1`,
          [medicine_id],
        );

    if (medicineResult.rows.length === 0) {
      throw new NotFoundException(
        'Medicine not found',
      );
    }

    const result =
      await this.databaseService
        .getPool()
        .query(
          `INSERT INTO prescription_items
           (
             prescription_id,
             medicine_id,
             dosage,
             frequency,
             duration,
             quantity,
             instructions
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING
             id,
             prescription_id,
             medicine_id,
             dosage,
             frequency,
             duration,
             quantity,
             instructions,
             created_at`,
          [
            prescription_id,
            medicine_id,
            dosage,
            frequency,
            duration,
            quantity,
            instructions,
          ],
        );

    return result.rows[0];
  }
}