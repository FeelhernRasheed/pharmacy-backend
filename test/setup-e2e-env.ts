// Runs before the test files are imported (jest setupFiles).
//
// ConfigModule.forRoot(...) in AppModule executes at module-import
// time, and its `validate` callback captures the environment as it
// exists at that moment. Environment variables for e2e tests must
// therefore be set here — before `import { AppModule }` runs — not
// inside beforeAll hooks.
process.env.RATE_LIMIT_MAX = '10';
process.env.RATE_LIMIT_TTL = '60';
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_TTL = '60';
