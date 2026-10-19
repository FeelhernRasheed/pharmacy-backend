import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

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
