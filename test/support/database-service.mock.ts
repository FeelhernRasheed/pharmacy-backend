/**
 * Test double for DatabaseService.
 *
 * The production service opens a transaction for every write and the
 * audit log is written inside that transaction. The mock mirrors that
 * behaviour so specs can assert on BEGIN / COMMIT / ROLLBACK without
 * touching a real database.
 *
 * Transaction control statements (BEGIN, COMMIT, ROLLBACK) are routed
 * to their own mock so they never consume the `mockResolvedValueOnce`
 * chain of the query mock.
 */

export interface DatabaseServiceMock {
  query: jest.Mock;
  transaction: jest.Mock;
  release: jest.Mock;
  client: {
    query: jest.Mock;
    release: jest.Mock;
  };
  provider: {
    getPool: () => {
      query: jest.Mock;
      connect: () => Promise<unknown>;
    };
    runInTransaction: <T>(
      work: (client: {
        query: jest.Mock;
        release: jest.Mock;
      }) => Promise<T>,
      executor?: unknown,
    ) => Promise<T>;
    testConnection: jest.Mock;
  };
}

const CONTROL_STATEMENTS = ['BEGIN', 'COMMIT', 'ROLLBACK'];

export function createDatabaseServiceMock(
  query: jest.Mock = jest.fn(),
): DatabaseServiceMock {
  const transaction: jest.Mock = jest
    .fn()
    .mockResolvedValue({ rows: [] });
  const release: jest.Mock = jest.fn();

  const run = jest.fn((sql: string, params?: unknown[]) => {
    if (CONTROL_STATEMENTS.includes(sql)) {
      transaction(sql);
      return Promise.resolve({ rows: [] });
    }

    return query(sql, params);
  });

  const client = {
    query: run,
    release,
  };

  return {
    query,
    transaction,
    release,
    client,
    provider: {
      getPool: () => ({
        query: run,
        connect: async () => client,
      }),
      runInTransaction: async <T>(
        work: (client: {
          query: jest.Mock;
          release: jest.Mock;
        }) => Promise<T>,
        executor?: unknown,
      ): Promise<T> => {
        if (executor) {
          return work(
            executor as {
              query: jest.Mock;
              release: jest.Mock;
            },
          );
        }

        await run('BEGIN');

        try {
          const result = await work(client);
          await run('COMMIT');
          return result;
        } catch (error) {
          await run('ROLLBACK');
          throw error;
        } finally {
          release();
        }
      },
      testConnection: jest.fn(),
    },
  };
}
