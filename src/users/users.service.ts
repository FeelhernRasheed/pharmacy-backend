import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { DatabaseService } from '../database/database.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getUsers() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           id,
           full_name,
           username,
           role,
           status,
           created_at,
           updated_at
         FROM users
         ORDER BY id ASC`,
      );

    return result.rows;
  }

  async getUserById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           id,
           full_name,
           username,
           role,
           status,
           created_at,
           updated_at
         FROM users
         WHERE id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return result.rows[0];
  }

  async createUser(createUserDto: CreateUserDto) {
    const {
      full_name,
      username,
      password,
      role,
    } = createUserDto;

    const existingUser = await this.databaseService
      .getPool()
      .query(
        `SELECT id
         FROM users
         WHERE username = $1`,
        [username],
      );

    if (existingUser.rows.length > 0) {
      throw new ConflictException(
        'Username already exists',
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      10,
    );

    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO users
         (
           full_name,
           username,
           password_hash,
           role
         )
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           full_name,
           username,
           role,
           status,
           created_at,
           updated_at`,
        [
          full_name,
          username,
          passwordHash,
          role,
        ],
      );

    return result.rows[0];
  }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
  ) {
    const existingUser = await this.databaseService
      .getPool()
      .query(
        `SELECT id
         FROM users
         WHERE id = $1`,
        [id],
      );

    if (existingUser.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const {
      full_name,
      username,
      password,
      role,
      status,
    } = updateUserDto;

    if (username) {
      const usernameCheck = await this.databaseService
        .getPool()
        .query(
          `SELECT id
           FROM users
           WHERE username = $1
           AND id <> $2`,
          [username, id],
        );

      if (usernameCheck.rows.length > 0) {
        throw new ConflictException(
          'Username already exists',
        );
      }
    }

    let passwordHash: string | null = null;

    if (password) {
      passwordHash = await bcrypt.hash(
        password,
        10,
      );
    }

    const result = await this.databaseService
      .getPool()
      .query(
        `UPDATE users
         SET
           full_name = COALESCE($1, full_name),
           username = COALESCE($2, username),
           password_hash = COALESCE($3, password_hash),
           role = COALESCE($4, role),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING
           id,
           full_name,
           username,
           role,
           status,
           created_at,
           updated_at`,
        [
          full_name ?? null,
          username ?? null,
          passwordHash,
          role ?? null,
          status ?? null,
          id,
        ],
      );

    return result.rows[0];
  }
}