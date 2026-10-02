import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getAuditLogs() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           al.id,
           al.user_id,
           u.full_name AS user_name,
           u.username,
           u.role,
           al.action,
           al.module,
           al.record_id,
           al.description,
           al.created_at
         FROM audit_logs al
         LEFT JOIN users u
           ON al.user_id = u.id
         ORDER BY al.id ASC`,
      );

    return result.rows;
  }

  async getAuditLogById(id: number) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           al.id,
           al.user_id,
           u.full_name AS user_name,
           u.username,
           u.role,
           al.action,
           al.module,
           al.record_id,
           al.description,
           al.created_at
         FROM audit_logs al
         LEFT JOIN users u
           ON al.user_id = u.id
         WHERE al.id = $1`,
        [id],
      );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'Audit log not found',
      );
    }

    return result.rows[0];
  }

  async createAuditLog(
    userId: number | null,
    action: string,
    module: string,
    recordId: number | null,
    description: string,
  ) {
    const result = await this.databaseService
      .getPool()
      .query(
        `INSERT INTO audit_logs
         (
           user_id,
           action,
           module,
           record_id,
           description
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id,
           user_id,
           action,
           module,
           record_id,
           description,
           created_at`,
        [
          userId,
          action,
          module,
          recordId,
          description,
        ],
      );

    return result.rows[0];
  }
}