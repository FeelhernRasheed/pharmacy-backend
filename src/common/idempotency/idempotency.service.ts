import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';

import { fingerprintRequest } from './request-fingerprint';

// PostgreSQL error codes used to detect that the idempotency table is
// not usable yet: the table is missing (42P01) or the table exists but
// the fingerprint column has not been added yet (42703).
const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';

export interface IdempotencyRequest<T> {
  /** Logical endpoint the key belongs to, e.g. `POST /payments`. */
  endpoint: string;
  /** HTTP method of the request, e.g. `POST`. */
  method: string;
  /** The explicit `Idempotency-Key` of the request. */
  key: string;
  /** The validated request payload the key is bound to. */
  payload: unknown;
  /** The business operation, executed inside the idempotency transaction. */
  handler: (client: PoolClient) => Promise<T>;
  /** Status code stored for a successful execution. Defaults to 201. */
  statusCode?: number;
}

export interface IdempotencyOutcome<T> {
  /** True when the stored response of an earlier request was replayed. */
  replayed: boolean;
  /** The status code of the original request. */
  statusCode: number;
  /** The body of the original request. */
  result: T;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  /**
   * Set once the idempotency table proved to be unusable. From that
   * moment on the service stops touching it and runs requests without
   * idempotency protection instead of failing every write.
   */
  private storageUnavailable = false;

  constructor(private readonly database: DatabaseService) {}

  async run<T>(request: IdempotencyRequest<T>): Promise<IdempotencyOutcome<T>> {
    const { endpoint, method, key, payload, handler } = request;
    const statusCode = request.statusCode ?? 201;
    const fingerprint = fingerprintRequest({ method, endpoint, payload });

    if (this.storageUnavailable) {
      return this.executeWithoutIdempotency(handler, statusCode);
    }

    try {
      return await this.execute({
        endpoint,
        key,
        fingerprint,
        handler,
        statusCode,
      });
    } catch (error) {
      if (!this.isSchemaNotReady(error)) {
        throw error;
      }

      this.storageUnavailable = true;
      this.logger.warn(
        `Idempotency storage is not available (${this.describeSchemaError(error)}). ` +
          'Requests are executed without idempotency protection until the database is migrated.',
      );

      return this.executeWithoutIdempotency(handler, statusCode);
    }
  }

  private async execute<T>(input: {
    endpoint: string;
    key: string;
    fingerprint: string;
    handler: (client: PoolClient) => Promise<T>;
    statusCode: number;
  }): Promise<IdempotencyOutcome<T>> {
    const { endpoint, key, fingerprint, handler, statusCode } = input;

    return this.database.runInTransaction(async (client) => {
      // The claim and the fingerprint are written in the same
      // transaction as the business change, so a key is either free or
      // completely bound to one request.
      const claim = await client.query(
        `INSERT INTO idempotency_keys (endpoint, idempotency_key, request_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (endpoint, idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [endpoint, key, fingerprint],
      );

      if (claim.rows.length === 0) {
        return this.replay(client, { endpoint, key, fingerprint });
      }

      const result = await handler(client);

      await client.query(
        `UPDATE idempotency_keys
         SET status_code = $3, response_body = $4
         WHERE endpoint = $1 AND idempotency_key = $2`,
        [endpoint, key, statusCode, JSON.stringify(result)],
      );

      return { replayed: false, statusCode, result };
    });
  }

  /**
   * Answers a request whose key is already known.
   *
   * The stored response is only replayed when the fingerprint of the
   * new request matches the stored one. A key that is reused with a
   * different payload is rejected with 409 and the business handler is
   * never executed.
   */
  private async replay<T>(
    client: PoolClient,
    input: { endpoint: string; key: string; fingerprint: string },
  ): Promise<IdempotencyOutcome<T>> {
    const { endpoint, key, fingerprint } = input;

    const existing = await client.query(
      `SELECT status_code, response_body, request_hash
       FROM idempotency_keys
       WHERE endpoint = $1 AND idempotency_key = $2`,
      [endpoint, key],
    );

    const row = existing.rows[0];

    if (!row || row.status_code === null || row.status_code === undefined) {
      throw new ConflictException(
        'A request with this Idempotency-Key is still being processed. Retry in a moment.',
      );
    }

    // Records written before fingerprinting existed carry no
    // fingerprint. Their payload cannot be verified, so they are
    // replayed the way they behaved before: the stored response is
    // returned. Rejecting them instead would turn a harmless retry
    // into a duplicate business change. New records always carry a
    // fingerprint, so this branch only covers the short window
    // between the two schema versions.
    if (row.request_hash === null || row.request_hash === undefined) {
      this.logger.warn(
        `Idempotency record ${endpoint} ${key} has no request fingerprint (legacy record). ` +
          'The stored response is replayed without verifying the payload.',
      );

      return {
        replayed: true,
        statusCode: row.status_code,
        result: row.response_body as T,
      };
    }

    if (row.request_hash !== fingerprint) {
      throw new ConflictException(
        'This Idempotency-Key was already used for a different request.',
      );
    }

    return {
      replayed: true,
      statusCode: row.status_code,
      result: row.response_body as T,
    };
  }

  /**
   * Runs the business operation without any idempotency protection.
   * Used when the idempotency table is not available in the database.
   */
  private async executeWithoutIdempotency<T>(
    handler: (client: PoolClient) => Promise<T>,
    statusCode: number,
  ): Promise<IdempotencyOutcome<T>> {
    const result = await this.database.runInTransaction((client) =>
      handler(client),
    );

    return { replayed: false, statusCode, result };
  }

  private isSchemaNotReady(error: unknown): boolean {
    const code = (error as { code?: string } | undefined)?.code;

    return code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN;
  }

  private describeSchemaError(error: unknown): string {
    const code = (error as { code?: string } | undefined)?.code ?? 'unknown';
    const message =
      (error as { message?: string } | undefined)?.message ?? 'unknown error';

    return `${code} ${message}`;
  }
}
