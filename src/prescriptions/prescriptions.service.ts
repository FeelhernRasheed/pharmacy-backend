import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionItemDto } from './dto/create-prescription-item.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
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
    const prescriptionResult = await this.databaseService
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

    const itemsResult = await this.databaseService
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
    actorUserId?: number,
  ) {
    const {
      patient_id,
      notes,
      status,
    } = createPrescriptionDto;

    if (status && status !== 'PENDING') {
      throw new BadRequestException(
        'New prescriptions must start with status PENDING',
      );
    }

    const patientResult = await this.databaseService
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

    if (!actorUserId) {
      throw new NotFoundException(
        'Authenticated user not found',
      );
    }

    const userResult = await this.databaseService
      .getPool()
      .query(
        `SELECT id
         FROM users
         WHERE id = $1`,
        [actorUserId],
      );

    if (userResult.rows.length === 0) {
      throw new NotFoundException(
        'Prescriber not found',
      );
    }

    const result = await this.databaseService
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
          actorUserId,
          notes ?? null,
          status ?? 'PENDING',
        ],
      );

    const createdPrescription = result.rows[0];

    await this.auditLogsService.createAuditLog(
      actorUserId,
      'CREATE',
      'PRESCRIPTIONS',
      createdPrescription.id,
      `Created prescription: ${createdPrescription.id}`,
    );

    return createdPrescription;
  }

  async createPrescriptionItem(
    createPrescriptionItemDto: CreatePrescriptionItemDto,
    actorUserId?: number,
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

    if (!actorUserId) {
      throw new NotFoundException(
        'Authenticated user not found',
      );
    }

    const prescriptionResult =
      await this.databaseService
        .getPool()
        .query(
          `SELECT id, status
           FROM prescriptions
           WHERE id = $1`,
          [prescription_id],
        );

    if (prescriptionResult.rows.length === 0) {
      throw new NotFoundException(
        'Prescription not found',
      );
    }

    if (prescriptionResult.rows[0].status === 'COMPLETED') {
      throw new BadRequestException(
        'Cannot add items to a completed prescription',
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

    const result = await this.databaseService
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

    const createdItem = result.rows[0];

    await this.auditLogsService.createAuditLog(
      actorUserId,
      'CREATE',
      'PRESCRIPTION_ITEMS',
      createdItem.id,
      `Created prescription item: ${createdItem.id} for prescription: ${prescription_id}`,
    );

    return createdItem;
  }
}