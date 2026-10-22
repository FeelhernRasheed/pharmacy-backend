import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private closed = false;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      database: this.configService.get<string>('DB_NAME'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
      max: this.configService.get<number>('DB_POOL_MAX', 10),
      idleTimeoutMillis: this.configService.get<number>(
        'DB_POOL_IDLE_MS',
        30_000,
      ),
      connectionTimeoutMillis: this.configService.get<number>(
        'DB_POOL_CONNECT_MS',
        5_000,
      ),
    });

    // Idle-client failures (server restart, network drop) are
    // handled here so an unhandled 'error' event cannot crash
    // the process; the pool discards the broken client itself.
    this.pool.on('error', (error: Error) => {
      this.logger.error(
        `Unexpected idle pool client error: ${error.message}`,
      );
    });
  }

  getPool(): Pool {
    return this.pool;
  }

  /**
   * Runs `work` inside a single database transaction.
   *
   * When `executor` is supplied the caller already owns an open
   * transaction: the work runs on that client and no
   * BEGIN/COMMIT/ROLLBACK is issued here, so the outer owner stays in
   * charge of the commit. That is what allows a business change and
   * its audit log to be written in one atomic unit.
   */
  async runInTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
    executor?: PoolClient,
  ): Promise<T> {
    if (executor) {
      return work(executor);
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await work(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      // A failing ROLLBACK must never mask the original error.
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async testConnection(): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      await this.pool.end();
      this.logger.log('Database pool closed');
    } catch (error: unknown) {
      const detail =
        error instanceof Error
          ? error.message
          : String(error);
      this.logger.error(
        `Error while closing database pool: ${detail}`,
      );
    }
  }
}
