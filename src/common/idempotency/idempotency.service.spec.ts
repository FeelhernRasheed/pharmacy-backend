import {
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createDatabaseServiceMock } from '../../../test/support/database-service.mock';
import type { DatabaseServiceMock } from '../../../test/support/database-service.mock';

import { DatabaseService } from '../../database/database.service';

import { IdempotencyService } from './idempotency.service';
import { fingerprintRequest } from './request-fingerprint';

const ENDPOINT = 'POST /sales';
const KEY = 'key-12345678';

function fingerprintFor(payload: unknown): string {
  return fingerprintRequest({
    method: 'POST',
    endpoint: ENDPOINT,
    payload,
  });
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let database: DatabaseServiceMock;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    database = createDatabaseServiceMock(queryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: DatabaseService,
          useValue: database.provider,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  it('executes the handler once and stores the response for a new key', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({
          rows: [{ idempotency_key: KEY }],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn().mockResolvedValue({ id: 7 });
    const payload = { sale_id: 1 };

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload,
      handler,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.statusCode).toBe(201);
    expect(outcome.result).toEqual({ id: 7 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(database.client);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE idempotency_keys'),
      [
        ENDPOINT,
        KEY,
        201,
        JSON.stringify({ id: 7 }),
      ],
    );
  });

  it('stores the fingerprint of the request together with the key', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [{ idempotency_key: KEY }] });
      }

      return Promise.resolve({ rows: [] });
    });

    const payload = { sale_id: 1, amount: 25.5 };

    await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload,
      handler: jest.fn().mockResolvedValue({ id: 7 }),
    });

    const insertCall = queryMock.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO idempotency_keys'),
    );

    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toContain('request_hash');
    expect(insertCall[1]).toEqual([
      ENDPOINT,
      KEY,
      fingerprintFor(payload),
    ]);
  });

  it('replays the stored response instead of running the handler again', async () => {
    const payload = { sale_id: 1 };

    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('SELECT status_code')) {
        return Promise.resolve({
          rows: [
            {
              status_code: 201,
              response_body: { id: 7 },
              request_hash: fingerprintFor(payload),
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn();

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload,
      handler,
    });

    expect(outcome.replayed).toBe(true);
    expect(outcome.statusCode).toBe(201);
    expect(outcome.result).toEqual({ id: 7 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('replays the stored response for an equivalent payload', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('SELECT status_code')) {
        return Promise.resolve({
          rows: [
            {
              status_code: 201,
              response_body: { id: 7 },
              request_hash: fingerprintFor({ sale_id: 1, amount: 25.5 }),
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn();

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload: { amount: 25.5, sale_id: 1 },
      handler,
    });

    expect(outcome.replayed).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects a key that is reused with a different payload', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('SELECT status_code')) {
        return Promise.resolve({
          rows: [
            {
              status_code: 201,
              response_body: { id: 7 },
              request_hash: fingerprintFor({ sale_id: 1, amount: 25.5 }),
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn();

    await expect(
      service.run({
        endpoint: ENDPOINT,
        method: 'POST',
        key: KEY,
        payload: { sale_id: 1, amount: 30 },
        handler,
      }),
    ).rejects.toThrow(ConflictException);

    expect(handler).not.toHaveBeenCalled();
    expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    expect(
      queryMock.mock.calls.some(([sql]: [string]) =>
        sql.includes('UPDATE idempotency_keys'),
      ),
    ).toBe(false);
  });

  it('replays a legacy record that has no fingerprint', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('SELECT status_code')) {
        return Promise.resolve({
          rows: [
            {
              status_code: 201,
              response_body: { id: 7 },
              request_hash: null,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn();

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload: { sale_id: 1, amount: 30 },
      handler,
    });

    expect(outcome.replayed).toBe(true);
    expect(outcome.result).toEqual({ id: 7 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects a key whose request is still in progress', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('SELECT status_code')) {
        return Promise.resolve({
          rows: [
            {
              status_code: null,
              response_body: null,
              request_hash: fingerprintFor({ sale_id: 1 }),
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn();

    await expect(
      service.run({
        endpoint: ENDPOINT,
        method: 'POST',
        key: KEY,
        payload: { sale_id: 1 },
        handler,
      }),
    ).rejects.toThrow(ConflictException);

    expect(handler).not.toHaveBeenCalled();
  });

  it('releases the key when the handler fails', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.resolve({ rows: [{ idempotency_key: KEY }] });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest
      .fn()
      .mockRejectedValue(new Error('sale failed'));

    await expect(
      service.run({
        endpoint: ENDPOINT,
        method: 'POST',
        key: KEY,
        payload: { sale_id: 1 },
        handler,
      }),
    ).rejects.toThrow('sale failed');

    expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    expect(
      queryMock.mock.calls.some(([sql]: [string]) =>
        sql.includes('UPDATE idempotency_keys'),
      ),
    ).toBe(false);
  });

  it('runs without idempotency when the key table is missing', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.reject({ code: '42P01' });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn().mockResolvedValue({ id: 9 });

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload: { sale_id: 1 },
      handler,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.result).toEqual({ id: 9 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(database.transaction).toHaveBeenCalledWith('COMMIT');
  });

  it('runs without idempotency when the fingerprint column is missing', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.reject({ code: '42703' });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn().mockResolvedValue({ id: 9 });

    const outcome = await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload: { sale_id: 1 },
      handler,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.result).toEqual({ id: 9 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(database.transaction).toHaveBeenCalledWith('COMMIT');
  });

  it('stops touching the key table once it is known to be missing', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return Promise.reject({ code: '42P01' });
      }

      return Promise.resolve({ rows: [] });
    });

    const handler = jest.fn().mockResolvedValue({ id: 9 });

    await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: KEY,
      payload: { sale_id: 1 },
      handler,
    });
    await service.run({
      endpoint: ENDPOINT,
      method: 'POST',
      key: 'key-87654321',
      payload: { sale_id: 1 },
      handler,
    });

    const insertCalls = queryMock.mock.calls.filter(
      ([sql]: [string]) => sql.includes('INSERT INTO idempotency_keys'),
    );

    expect(insertCalls).toHaveLength(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
