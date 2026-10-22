/**
 * Applies the approved database migrations to the dedicated test
 * database only.
 *
 * Usage:
 *   npm run db:migrate:test
 *
 * SAFETY
 * ------
 * * The target is resolved from TEST_DB_* (env vars or the git-ignored
 *   file test/.env.test) and the script aborts unless it is
 *   `pharmacy_test` on the test instance.
 * * The development database (Pharmacy-db) is never reachable from
 *   here: the resolved name is checked before the connection is opened
 *   and the connected database is checked again afterwards.
 * * Only the migrations listed in APPROVED_MIGRATIONS are executed.
 *   `001_fk_indexes.sql` is deliberately absent — it is a review-only
 *   migration that is still waiting for explicit approval.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Client } from 'pg';

import {
  TEST_DATABASE_NAME,
  resolveTestDatabaseConfig,
} from '../test/support/test-database.env';

const APPROVED_MIGRATIONS = [
  '002_idempotency_keys.sql',
  '003_idempotency_request_hash.sql',
];

async function main(): Promise<void> {
  const config = resolveTestDatabaseConfig();

  console.log('Test database migration');
  console.log(
    `  target: ${config.name} @ ${config.host}:${config.port} (user ${config.user})`,
  );

  if (config.name.toLowerCase() !== TEST_DATABASE_NAME.toLowerCase()) {
    throw new Error(
      `Refusing to migrate "${config.name}": only "${TEST_DATABASE_NAME}" may be migrated by this script.`,
    );
  }

  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
  });

  await client.connect();

  try {
    const current = await client.query<{ db: string }>(
      'SELECT current_database() AS db',
    );

    if (current.rows[0].db.toLowerCase() !== TEST_DATABASE_NAME.toLowerCase()) {
      throw new Error(
        `Connected to "${current.rows[0].db}" instead of "${TEST_DATABASE_NAME}".`,
      );
    }

    for (const file of APPROVED_MIGRATIONS) {
      const path = resolve(process.cwd(), 'db', 'migrations', file);
      const sql = readFileSync(path, 'utf8');

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`  applied: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client.end();
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
