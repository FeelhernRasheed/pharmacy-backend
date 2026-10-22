import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Pins every database-backed automated test to the dedicated test
 * database (pharmacy_test on the test PostgreSQL instance).
 *
 * WHY THIS EXISTS
 * ---------------
 * `ConfigModule.forRoot(...)` in `src/app.module.ts` loads `.env` at
 * import time and merges it *under* `process.env`
 * (`{ ...config, ...process.env }`); `assignVariablesToProcess` then
 * never overwrites a key that is already present in `process.env`.
 * The jest `setupFiles` run before the spec files import `AppModule`,
 * so the values assigned here are the ones the pg pool actually uses.
 *
 * Without this assignment the suites silently inherit `DB_*` from
 * `.env` and connect to the development database (`Pharmacy-db`),
 * where the integration suite inserts and deletes rows.
 *
 * CONFIGURATION
 * -------------
 * The connection details come from `TEST_DB_*` environment variables
 * or from the git-ignored file `test/.env.test`:
 *
 *   TEST_DB_HOST     default 127.0.0.1
 *   TEST_DB_PORT     default 55432
 *   TEST_DB_NAME     default pharmacy_test
 *   TEST_DB_USER     default pharmacy_test_user
 *   TEST_DB_PASSWORD required (never taken from `.env`)
 *
 * The password is deliberately *not* defaulted: the development
 * database credentials in `.env` must never be reused for the test
 * instance, and a missing password has to fail loudly.
 */

/** The only database automated tests may target. */
export const TEST_DATABASE_NAME = 'pharmacy_test';

/** The development database, which must never be targeted by tests. */
export const DEVELOPMENT_DATABASE_NAME = 'Pharmacy-db';

export const TEST_DATABASE_DEFAULT_HOST = '127.0.0.1';
export const TEST_DATABASE_DEFAULT_PORT = 55432;
export const TEST_DATABASE_DEFAULT_USER = 'pharmacy_test_user';

export interface TestDatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

function readKeyValueFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const entries: Record<string, string> = {};

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== '') {
      entries[key] = value;
    }
  }

  return entries;
}

function testEnvFilePath(): string {
  return resolve(process.cwd(), 'test', '.env.test');
}

/**
 * Resolves the test database connection details and refuses any
 * configuration that does not point at the test database.
 */
export function resolveTestDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): TestDatabaseConfig {
  const file = readKeyValueFile(testEnvFilePath());

  const read = (
    key: string,
    fallback?: string,
  ): string | undefined => {
    const value = env[key] ?? file[key] ?? fallback;

    return value !== undefined && value.trim() !== ''
      ? value.trim()
      : undefined;
  };

  const name = read('TEST_DB_NAME', TEST_DATABASE_NAME)!;
  const host = read('TEST_DB_HOST', TEST_DATABASE_DEFAULT_HOST)!;
  const portRaw = read(
    'TEST_DB_PORT',
    String(TEST_DATABASE_DEFAULT_PORT),
  )!;
  const user = read('TEST_DB_USER', TEST_DATABASE_DEFAULT_USER)!;
  const password = read('TEST_DB_PASSWORD');

  if (name.toLowerCase() !== TEST_DATABASE_NAME.toLowerCase()) {
    throw new Error(
      `Refusing to run against database "${name}": automated tests may ` +
        `only target "${TEST_DATABASE_NAME}". Set TEST_DB_NAME to the ` +
        'test database.',
    );
  }

  const port = Number(portRaw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `TEST_DB_PORT must be an integer between 1 and 65535, got ` +
        `"${portRaw}".`,
    );
  }

  if (password === undefined) {
    throw new Error(
      'TEST_DB_PASSWORD is missing. Provide it in the git-ignored file ' +
        'test/.env.test or as a TEST_DB_PASSWORD environment variable. ' +
        'The development database password from .env is never reused ' +
        'for the test instance.',
    );
  }

  return { host, port, name, user, password };
}

/**
 * Publishes the resolved test database connection as `DB_*` so the
 * application and the direct pg pools in the tests both use it.
 */
export function applyTestDatabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): TestDatabaseConfig {
  const config = resolveTestDatabaseConfig(env);

  env.DB_HOST = config.host;
  env.DB_PORT = String(config.port);
  env.DB_NAME = config.name;
  env.DB_USER = config.user;
  env.DB_PASSWORD = config.password;

  return config;
}

/**
 * Guards code paths that read `DB_*` directly (the direct pg pool used
 * for fixture setup and state assertions). It fails fast if the
 * environment was not pinned by `applyTestDatabaseEnv`.
 */
export function assertTestDatabaseTarget(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const name = env.DB_NAME;

  if (
    name === undefined ||
    name.toLowerCase() !== TEST_DATABASE_NAME.toLowerCase()
  ) {
    throw new Error(
      `Refusing to run against database "${name ?? '<unset>'}": ` +
        `automated tests may only target "${TEST_DATABASE_NAME}".`,
    );
  }
}
