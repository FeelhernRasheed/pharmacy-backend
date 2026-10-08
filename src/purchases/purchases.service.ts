import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getPurchases() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.supplier_id,
           s.name AS supplier_name,
           p.purchase_date,
           p.invoice_number,
           p.total_amount,
           p.status,
           p.created_at
         FROM purchases p
         INNER JOIN suppliers s
           ON p.supplier_id = s.id
         ORDER BY p.id ASC`,
      );

    return result.rows;
  }

  async getPurchaseById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           p.id,
           p.supplier_id,
           s.name AS supplier_name,
           p.purchase_date,
           p.invoice_number,
           p.total_amount,
           p.status,
           p.created_at
         FROM purchases p
         INNER JOIN suppliers s
           ON p.supplier_id = s.id
         WHERE p.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Purchase not found');
    }

    return result.rows[0];
  }

  async createPurchase(
    createPurchaseDto: CreatePurchaseDto,
    actorUserId?: number,
  ) {
    const {
      supplier_id,
      invoice_number,
    } = createPurchaseDto;

    const supplier = await this.databaseService
      .getPool()
      .query(
        'SELECT id FROM suppliers WHERE id = $1',
        [supplier_id],
      );

    if (supplier.rows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO purchases
         (
           supplier_id,
           invoice_number
         )
         VALUES ($1, $2)
         RETURNING *`,
        [
          supplier_id,
          invoice_number ?? null,
        ],
      );

    const createdPurchase = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'CREATE',
        'PURCHASES',
        createdPurchase.id,
        `Created purchase: ${createdPurchase.invoice_number ?? createdPurchase.id}`,
      );
    }

    return createdPurchase;
  }

  async updatePurchase(
    id: number,
    updatePurchaseDto: UpdatePurchaseDto,
    actorUserId?: number,
  ) {
    const {
      invoice_number,
      status,
    } = updatePurchaseDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE purchases
         SET invoice_number = COALESCE($1, invoice_number),
             status = COALESCE($2, status)
         WHERE id = $3
         RETURNING *`,
        [
          invoice_number ?? null,
          status ?? null,
          id,
        ],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Purchase not found');
    }

    const updatedPurchase = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'UPDATE',
        'PURCHASES',
        updatedPurchase.id,
        `Updated purchase: ${updatedPurchase.invoice_number ?? updatedPurchase.id}`,
      );
    }

    return updatedPurchase;
  }

  async deletePurchase(
    id: number,
    actorUserId?: number,
  ) {
    const result = await this.databaseService
      .getPool()
      .query(
        `DELETE FROM purchases
         WHERE id = $1
         RETURNING *`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Purchase not found');
    }

    const deletedPurchase = result.rows[0];

    if (actorUserId) {
      await this.auditLogsService.createAuditLog(
        actorUserId,
        'DELETE',
        'PURCHASES',
        deletedPurchase.id,
        `Deleted purchase: ${deletedPurchase.invoice_number ?? deletedPurchase.id}`,
      );
    }

    return {
      message: 'Purchase deleted successfully',
      purchase: deletedPurchase,
    };
  }
}