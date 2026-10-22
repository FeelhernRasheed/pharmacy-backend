import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';

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
    executor?: PoolClient,
  ) {
    const { patient_id } = createSaleDto;

    return this.databaseService.runInTransaction(
      async (client) => {
        if (patient_id) {
          const patient = await client.query(
            'SELECT id FROM patients WHERE id = $1',
            [patient_id],
          );

          if (patient.rows.length === 0) {
            throw new NotFoundException('Patient not found');
          }
        }

        const result = await client.query(
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
            client,
          );
        }

        return createdSale;
      },
      executor,
    );
  }

  async updateSale(
    id: number,
    status?: string,
    actorUserId?: number,
  ) {
    const allowedStatuses = [
      'PENDING',
      'COMPLETED',
      'CANCELLED',
    ];

    if (status && !allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid sale status. Allowed statuses: ${allowedStatuses.join(', ')}`,
      );
    }

    return this.databaseService.runInTransaction(
      async (client) => {
        const saleResult = await client.query(
          'SELECT id, status FROM sales WHERE id = $1 FOR UPDATE',
          [id],
        );

        if (saleResult.rows.length === 0) {
          throw new NotFoundException('Sale not found');
        }

        const sale = saleResult.rows[0];

        if (sale.status === 'CANCELLED') {
          throw new ConflictException(
            'A cancelled sale cannot be reopened',
          );
        }

        if (status === 'CANCELLED') {
          const paymentsResult = await client.query(
            `SELECT COUNT(*) AS payment_count
             FROM payments
             WHERE sale_id = $1 AND status = 'COMPLETED'`,
            [id],
          );

          if (Number(paymentsResult.rows[0].payment_count) > 0) {
            throw new ConflictException(
              'Cannot cancel a sale that has completed payments',
            );
          }

          await client.query(
            `UPDATE medicine_batches mb
             SET quantity = mb.quantity + si.quantity
             FROM sale_items si
             WHERE si.batch_id = mb.id
               AND si.sale_id = $1`,
            [id],
          );
        }

        const updateResult = await client.query(
          `UPDATE sales
           SET status = COALESCE($1, status)
           WHERE id = $2
           RETURNING *`,
          [status ?? null, id],
        );

        const updatedSale = updateResult.rows[0];

        if (actorUserId) {
          await this.auditLogsService.createAuditLog(
            actorUserId,
            'UPDATE',
            'SALES',
            updatedSale.id,
            `Updated sale: ${updatedSale.id} status to ${updatedSale.status}`,
            client,
          );
        }

        return updatedSale;
      },
    );
  }

  async deleteSale(
    id: number,
    actorUserId?: number,
  ) {
    return this.databaseService.runInTransaction(
      async (client) => {
        const references = await client.query(
          `SELECT
             (SELECT COUNT(*) FROM sale_items WHERE sale_id = $1) AS sale_items,
             (SELECT COUNT(*) FROM payments WHERE sale_id = $1) AS payments`,
          [id],
        );

        const ref = references.rows[0];

        if (
          Number(ref.sale_items) > 0 ||
          Number(ref.payments) > 0
        ) {
          throw new ConflictException(
            'Cannot delete a sale that has sale items or payments. Cancel the sale instead.',
          );
        }

        const result = await client.query(
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
            client,
          );
        }

        return {
          message: 'Sale deleted successfully',
          sale: deletedSale,
        };
      },
    );
  }
}
