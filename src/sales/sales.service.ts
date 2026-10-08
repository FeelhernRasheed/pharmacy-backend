import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getSales() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           s.id,
           s.patient_id,
           p.full_name AS patient_name,
           s.sale_date,
           s.total_amount,
           s.status,
           s.created_at
         FROM sales s
         LEFT JOIN patients p
           ON s.patient_id = p.id
         ORDER BY s.id ASC`,
      );

    return result.rows;
  }

  async getSaleById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           s.id,
           s.patient_id,
           p.full_name AS patient_name,
           s.sale_date,
           s.total_amount,
           s.status,
           s.created_at
         FROM sales s
         LEFT JOIN patients p
           ON s.patient_id = p.id
         WHERE s.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Sale not found');
    }

    return result.rows[0];
  }

  async createSale(
    createSaleDto: CreateSaleDto,
    actorUserId?: number,
  ) {
    const { patient_id } = createSaleDto;

    if (patient_id) {
      const patient = await this.databaseService
        .getPool()
        .query(
          'SELECT id FROM patients WHERE id = $1',
          [patient_id],
        );

      if (patient.rows.length === 0) {
        throw new NotFoundException('Patient not found');
      }
    }

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO sales
         (
           patient_id
         )
         VALUES ($1)
         RETURNING *`,
        [
          patient_id ?? null,
        ],
      );

    const createdSale = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'CREATE',
        'SALES',
        createdSale.id,
        `Created sale: ${createdSale.id}`,
      );
    }

    return createdSale;
  }

  async updateSale(
    id: number,
    status?: string,
    actorUserId?: number,
  ) {
    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE sales
         SET status = COALESCE($1, status)
         WHERE id = $2
         RETURNING *`,
        [
          status ?? null,
          id,
        ],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Sale not found');
    }

    const updatedSale = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'UPDATE',
        'SALES',
        updatedSale.id,
        `Updated sale: ${updatedSale.id}`,
      );
    }

    return updatedSale;
  }

  async deleteSale(
    id: number,
    actorUserId?: number,
  ) {
    const result = await this.databaseService
      .getPool()
      .query(
        `DELETE FROM sales
         WHERE id = $1
         RETURNING *`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Sale not found');
    }

    const deletedSale = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'DELETE',
        'SALES',
        deletedSale.id,
        `Deleted sale: ${deletedSale.id}`,
      );
    }

    return {
      message: 'Sale deleted successfully',
      sale: deletedSale,
    };
  }
}