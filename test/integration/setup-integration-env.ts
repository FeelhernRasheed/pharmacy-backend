// Runs before the integration test files are imported (jest setupFiles).
//
// The workflow suite issues many authenticated requests per test, so
// the tight rate limits used by the security e2e suite would produce
// false 429s. Values stay within the bounds enforced by validateEnv.
//
// The database variables are pinned here as well: this suite seeds and
// deletes rows, so it must never inherit DB_* from `.env` (which
// points at the development database Pharmacy-db). ConfigModule merges
// the env file *under* process.env, so assigning DB_* in this file is
// what keeps the suite on the test instance (pharmacy_test).
import { applyTestDatabaseEnv } from '../support/test-database.env';

applyTestDatabaseEnv();

process.env.RATE_LIMIT_MAX = '10000';
process.env.RATE_LIMIT_TTL = '60';
process.env.AUTH_RATE_LIMIT_MAX = '100';
process.env.AUTH_RATE_LIMIT_TTL = '60';
