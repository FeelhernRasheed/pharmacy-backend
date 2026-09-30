import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getCategories() {
    const result = await this.databaseService
      .getPool()
      .query(
        'SELECT * FROM medicine_categories ORDER BY id ASC',
      );

    return result.rows;
  }

  async getCategoryById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        'SELECT * FROM medicine_categories WHERE id = $1',
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return result.rows[0];
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    const { name, description } = createCategoryDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO medicine_categories (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description ?? null],
      );

    return result.rows[0];
  }

  async updateCategory(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const { name, description } = updateCategoryDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE medicine_categories
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [name ?? null, description ?? null, id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return result.rows[0];
  }

  async deleteCategory(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        'DELETE FROM medicine_categories WHERE id = $1 RETURNING *',
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return {
      message: 'Category deleted successfully',
      category: result.rows[0],
    };
  }
}