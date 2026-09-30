import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

@Injectable()
export class MedicinesService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getMedicines() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           m.id,
           m.name,
           m.strength,
           m.category_id,
           c.name AS category_name,
           m.created_at
         FROM medicines m
         LEFT JOIN medicine_categories c
           ON m.category_id = c.id
         ORDER BY m.id ASC`,
      );

    return result.rows;
  }

  async getMedicineById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           m.id,
           m.name,
           m.strength,
           m.category_id,
           c.name AS category_name,
           m.created_at
         FROM medicines m
         LEFT JOIN medicine_categories c
           ON m.category_id = c.id
         WHERE m.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Medicine not found');
    }

    return result.rows[0];
  }

  async createMedicine(createMedicineDto: CreateMedicineDto) {
    const { name, strength, category_id } = createMedicineDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO medicines (name, strength, category_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, strength, category_id],
      );

    return result.rows[0];
  }

  async updateMedicine(
    id: number,
    updateMedicineDto: UpdateMedicineDto,
  ) {
    const { name, strength, category_id } = updateMedicineDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE medicines
         SET name = $1,
             strength = $2,
             category_id = $3
         WHERE id = $4
         RETURNING *`,
        [name, strength, category_id, id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Medicine not found');
    }

    return result.rows[0];
  }

  async deleteMedicine(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        'DELETE FROM medicines WHERE id = $1 RETURNING *',
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Medicine not found');
    }

    return {
      message: 'Medicine deleted successfully',
      medicine: result.rows[0],
    };
  }
}