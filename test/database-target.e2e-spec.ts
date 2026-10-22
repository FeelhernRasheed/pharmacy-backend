import { Client } from 'pg';

import {
  DEVELOPMENT_DATABASE_NAME,
  TEST_DATABASE_NAME,
} from './support/test-database.env';

/**
 * Regression guard for the database safety rules.
 *
 * The jest setup file (test/setup-e2e-env.ts) publishes DB_* before
 * AppModule is imported, because ConfigModule merges the values of
 * `.env` *under* the ones already present in process.env. `.env`
 * describes the development database, so without that pinning every
 * suite would silently talk to Pharmacy-db.
 *
 * This spec fails as soon as the suites drift away from the dedicated
 * test instance.
 */
describe('Test database target (e2e)', () => {
  it('publishes the test database as the connection target', () => {
    expect(process.env.DB_NAME).toBe(TEST_DATABASE_NAME);
    expect(process.env.DB_NAME).not.toBe(DEVELOPMENT_DATABASE_NAME);
    expect(process.env.DB_HOST).toBeDefined();
    expect(process.env.DB_USER).toBeDefined();
    expect(process.env.DB_PASSWORD).toBeDefined();
  });

  it('connects to the test database', async () => {
    const client = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    await client.connect();

    try {
      const result = await client.query<{ db: string }>(
        'SELECT current_database() AS db',
      );

      expect(result.rows[0].db).toBe(TEST_DATABASE_NAME);
    } finally {
      await client.end();
    }
  });
});
