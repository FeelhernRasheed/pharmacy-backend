import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getSuppliers() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT *
         FROM suppliers
         ORDER BY id ASC`,
      );

    return result.rows;
  }

  async getSupplierById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT *
         FROM suppliers
         WHERE id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }

    return result.rows[0];
  }

  async createSupplier(createSupplierDto: CreateSupplierDto) {
    const {
      name,
      phone,
      email,
      address,
    } = createSupplierDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO suppliers
         (
           name,
           phone,
           email,
           address
         )
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          name,
          phone ?? null,
          email ?? null,
          address ?? null,
        ],
      );

    return result.rows[0];
  }

  async updateSupplier(
    id: number,
    updateSupplierDto: UpdateSupplierDto,
  ) {
    const {
      name,
      phone,
      email,
      address,
    } = updateSupplierDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE suppliers
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             address = COALESCE($4, address),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [
          name ?? null,
          phone ?? null,
          email ?? null,
          address ?? null,
          id,
        ],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }

    return result.rows[0];
  }

  async deleteSupplier(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `DELETE FROM suppliers
         WHERE id = $1
         RETURNING *`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Supplier not found');
    }

    return {
      message: 'Supplier deleted successfully',
      supplier: result.rows[0],
    };
  }
}