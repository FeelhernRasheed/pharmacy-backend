import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly databaseService: DatabaseService,
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

  async createSale(createSaleDto: CreateSaleDto) {
    const { patient_id } = createSaleDto;

    if (patient_id !== undefined) {
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
        [patient_id ?? null],
      );

    return result.rows[0];
  }
}