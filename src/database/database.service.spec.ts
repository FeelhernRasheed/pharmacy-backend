import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

const PoolMock = Pool as unknown as jest.Mock;

describe('DatabaseService', () => {
  let pool: {
    on: jest.Mock;
    end: jest.Mock;
    connect: jest.Mock;
    query: jest.Mock;
  };

  const configValues: Record<string, unknown> = {
    DB_HOST: 'db.example.internal',
    DB_PORT: 5433,
    DB_NAME: 'pharmacy',
    DB_USER: 'app_user',
    DB_PASSWORD: 'pool-test-password',
    DB_POOL_MAX: 25,
    DB_POOL_IDLE_MS: 60_000,
    DB_POOL_CONNECT_MS: 10_000,
  };

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues
        ? configValues[key]
        : (fallback ?? undefined),
    ),
  };

  async function createService(): Promise<DatabaseService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    return moduleRef.get(DatabaseService);
  }

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pool = {
      on: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      query: jest.fn(),
    };
    PoolMock.mockImplementation(() => pool);
  });

  it('configures the pool from validated environment values', async () => {
    await createService();

    expect(PoolMock).toHaveBeenCalledWith({
      host: 'db.example.internal',
      port: 5433,
      database: 'pharmacy',
      user: 'app_user',
      password: 'pool-test-password',
      max: 25,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
    });
  });

  it('attaches an idle-client error handler so unhandled pool errors cannot crash', async () => {
    await createService();

    expect(pool.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );

    const handler = pool.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'error',
    )?.[1] as (error: Error) => void;

    expect(() =>
      handler(new Error('server closed the connection')),
    ).not.toThrow();
  });

  it('returns the underlying pool from getPool', async () => {
    const service = await createService();

    expect(service.getPool()).toBe(pool);
  });

  it('releases the client after testConnection succeeds', async () => {
    const service = await createService();
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    await expect(service.testConnection()).resolves.toBe(true);
    expect(client.query).toHaveBeenCalledWith('SELECT 1');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('releases the client even when the query fails', async () => {
    const service = await createService();
    const client = {
      query: jest
        .fn()
        .mockRejectedValue(new Error('connection terminated')),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    await expect(service.testConnection()).rejects.toThrow(
      'connection terminated',
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('ends the pool exactly once on shutdown', async () => {
    const service = await createService();

    await service.onApplicationShutdown();
    await service.onApplicationShutdown();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('does not throw when pool.end rejects during shutdown', async () => {
    const service = await createService();
    pool.end.mockRejectedValue(new Error('pool already closed'));

    await expect(service.onApplicationShutdown()).resolves.toBe(
      undefined,
    );
  });
});
