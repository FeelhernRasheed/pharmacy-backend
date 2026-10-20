// Runs before the integration test files are imported (jest setupFiles).
//
// The workflow suite issues many authenticated requests per test, so
// the tight rate limits used by the security e2e suite would produce
// false 429s. Values stay within the bounds enforced by validateEnv.
process.env.RATE_LIMIT_MAX = '10000';
process.env.RATE_LIMIT_TTL = '60';
process.env.AUTH_RATE_LIMIT_MAX = '100';
process.env.AUTH_RATE_LIMIT_TTL = '60';
