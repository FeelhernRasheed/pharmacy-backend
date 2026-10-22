import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

/**
 * Minimal query surface needed to persist an audit log. Both the
 * connection pool and a transaction client satisfy it, so a caller can
 * write the audit row inside its own transaction and make the audit
 * log and the business change commit (or roll back) together.
 */
export interface AuditLogExecutor {
  query(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: any[] }>;
}

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
    executor?: AuditLogExecutor,
  ) {
    const target: AuditLogExecutor =
      executor ?? this.databaseService.getPool();

    const result = await target.query(
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