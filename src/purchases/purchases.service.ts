import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

const ALLOWED_PURCHASE_STATUSES = [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
];

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

    if (
      status &&
      !ALLOWED_PURCHASE_STATUSES.includes(status)
    ) {
      throw new BadRequestException(
        `Invalid purchase status. Allowed statuses: ${ALLOWED_PURCHASE_STATUSES.join(', ')}`,
      );
    }

    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    let updatedPurchase: Record<string, any>;

    try {
      await client.query('BEGIN');

      // Lock the purchase so a concurrent createPurchaseItem
      // (which also locks the purchase) cannot add stock between
      // the cancellation check and the status update.
      const purchaseResult = await client.query(
        'SELECT id, status FROM purchases WHERE id = $1 FOR UPDATE',
        [id],
      );

      if (purchaseResult.rows.length === 0) {
        throw new NotFoundException('Purchase not found');
      }

      if (status === 'CANCELLED') {
        const itemsResult = await client.query(
          'SELECT COUNT(*) AS item_count FROM purchase_items WHERE purchase_id = $1',
          [id],
        );

        if (Number(itemsResult.rows[0].item_count) > 0) {
          throw new ConflictException(
            'Cannot cancel a purchase that has items. Stock already received from this purchase cannot be reverted automatically.',
          );
        }
      }

      const updateResult = await client.query(
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

      updatedPurchase = updateResult.rows[0];

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

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
    const itemsResult =
      await this.databaseService
        .getPool()
        .query(
          'SELECT COUNT(*) AS item_count FROM purchase_items WHERE purchase_id = $1',
          [id],
        );

    if (Number(itemsResult.rows[0].item_count) > 0) {
      throw new ConflictException(
        'Cannot delete a purchase that has items. Stock already received from this purchase cannot be reverted automatically.',
      );
    }

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