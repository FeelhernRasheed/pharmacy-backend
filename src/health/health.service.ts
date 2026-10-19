import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  /** Liveness: the process is up and serving requests. */
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness: the app can serve traffic, i.e. PostgreSQL is
   * reachable through a bounded `SELECT 1`. Failures are logged
   * server-side only and surfaced to callers as a generic 503 —
   * no connection details, SQL, or exception messages leak.
   */
  async readiness(): Promise<{ status: 'ok' }> {
    try {
      await this.databaseService.testConnection();
      return { status: 'ok' };
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Readiness check failed: ${detail}`);
      throw new ServiceUnavailableException(
        'Service unavailable',
      );
    }
  }
}
