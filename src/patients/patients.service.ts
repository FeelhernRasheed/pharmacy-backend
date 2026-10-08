import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getPatients() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           id,
           full_name,
           phone,
           email,
           date_of_birth,
           gender,
           address,
           status,
           created_at,
           updated_at
         FROM patients
         ORDER BY id ASC`,
      );

    return result.rows;
  }

  async getPatientById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           id,
           full_name,
           phone,
           email,
           date_of_birth,
           gender,
           address,
           status,
           created_at,
           updated_at
         FROM patients
         WHERE id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Patient not found');
    }

    return result.rows[0];
  }

  async createPatient(
    createPatientDto: CreatePatientDto,
    actorUserId?: number,
  ) {
    const {
      full_name,
      phone,
      email,
      date_of_birth,
      gender,
      address,
    } = createPatientDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO patients
         (
           full_name,
           phone,
           email,
           date_of_birth,
           gender,
           address
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          full_name,
          phone ?? null,
          email ?? null,
          date_of_birth ?? null,
          gender ?? null,
          address ?? null,
        ],
      );

    const createdPatient = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'CREATE',
        'PATIENTS',
        createdPatient.id,
        `Created patient: ${createdPatient.full_name}`,
      );
    }

    return createdPatient;
  }

  async updatePatient(
    id: number,
    updatePatientDto: UpdatePatientDto,
    actorUserId?: number,
  ) {
    const {
      full_name,
      phone,
      email,
      date_of_birth,
      gender,
      address,
      status,
    } = updatePatientDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE patients
         SET full_name = COALESCE($1, full_name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             date_of_birth = COALESCE($4, date_of_birth),
             gender = COALESCE($5, gender),
             address = COALESCE($6, address),
             status = COALESCE($7, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [
          full_name ?? null,
          phone ?? null,
          email ?? null,
          date_of_birth ?? null,
          gender ?? null,
          address ?? null,
          status ?? null,
          id,
        ],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Patient not found');
    }

    const updatedPatient = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'UPDATE',
        'PATIENTS',
        updatedPatient.id,
        `Updated patient: ${updatedPatient.full_name}`,
      );
    }

    return updatedPatient;
  }

  async deletePatient(
    id: number,
    actorUserId?: number,
  ) {
    const result = await this.databaseService
      .getPool()
      .query(
        `DELETE FROM patients
         WHERE id = $1
         RETURNING *`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Patient not found');
    }

    const deletedPatient = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'DELETE',
        'PATIENTS',
        deletedPatient.id,
        `Deleted patient: ${deletedPatient.full_name}`,
      );
    }

    return {
      message: 'Patient deleted successfully',
      patient: deletedPatient,
    };
  }
}