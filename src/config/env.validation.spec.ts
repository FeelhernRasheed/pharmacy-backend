import {
  EnvValidationError,
  isSwaggerEnabled,
  resolveCorsOptions,
  validateEnv,
} from './env.validation';

const validBase = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'Pharmacy-db',
  DB_USER: 'postgres',
  DB_PASSWORD: 'not-a-real-password',
  JWT_SECRET: 'test-secret-value',
};

describe('validateEnv', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const result = validateEnv({ ...validBase });

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.DB_PORT).toBe(5432);
    expect(result.JWT_EXPIRY).toBe('1h');
    expect(result.SWAGGER_ENABLED).toBe('true');
    expect(result.CORS_ORIGIN).toBeUndefined();
    expect(result.HOST).toBeUndefined();
  });

  it('parses numeric PORT and DB_PORT to numbers', () => {
    const result = validateEnv({
      ...validBase,
      PORT: '8080',
      DB_PORT: '5433',
    });

    expect(result.PORT).toBe(8080);
    expect(result.DB_PORT).toBe(5433);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() =>
      validateEnv({ ...validBase, PORT: '70000' }),
    ).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('rejects a non-numeric DB_PORT', () => {
    expect(() =>
      validateEnv({ ...validBase, DB_PORT: 'abc' }),
    ).toThrow(
      'DB_PORT must be an integer between 1 and 65535',
    );
  });

  it('applies connection-pool defaults when unset', () => {
    const result = validateEnv({ ...validBase });

    expect(result.DB_POOL_MAX).toBe(10);
    expect(result.DB_POOL_IDLE_MS).toBe(30_000);
    expect(result.DB_POOL_CONNECT_MS).toBe(5_000);
  });

  it('parses custom pool settings to numbers', () => {
    const result = validateEnv({
      ...validBase,
      DB_POOL_MAX: '25',
      DB_POOL_IDLE_MS: '60000',
      DB_POOL_CONNECT_MS: '10000',
    });

    expect(result.DB_POOL_MAX).toBe(25);
    expect(result.DB_POOL_IDLE_MS).toBe(60_000);
    expect(result.DB_POOL_CONNECT_MS).toBe(10_000);
  });

  it('rejects an out-of-range DB_POOL_MAX', () => {
    expect(() =>
      validateEnv({ ...validBase, DB_POOL_MAX: '0' }),
    ).toThrow(
      'DB_POOL_MAX must be an integer between 1 and 100',
    );
  });

  it('rejects a non-numeric DB_POOL_CONNECT_MS', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        DB_POOL_CONNECT_MS: 'fast',
      }),
    ).toThrow(
      'DB_POOL_CONNECT_MS must be an integer between 250 and 120000',
    );
  });

  it('applies rate-limit defaults when unset', () => {
    const result = validateEnv({ ...validBase });

    expect(result.RATE_LIMIT_MAX).toBe(100);
    expect(result.RATE_LIMIT_TTL).toBe(60);
    expect(result.AUTH_RATE_LIMIT_MAX).toBe(10);
    expect(result.AUTH_RATE_LIMIT_TTL).toBe(60);
  });

  it('parses custom rate-limit settings to numbers', () => {
    const result = validateEnv({
      ...validBase,
      RATE_LIMIT_MAX: '250',
      RATE_LIMIT_TTL: '120',
      AUTH_RATE_LIMIT_MAX: '5',
      AUTH_RATE_LIMIT_TTL: '30',
    });

    expect(result.RATE_LIMIT_MAX).toBe(250);
    expect(result.RATE_LIMIT_TTL).toBe(120);
    expect(result.AUTH_RATE_LIMIT_MAX).toBe(5);
    expect(result.AUTH_RATE_LIMIT_TTL).toBe(30);
  });

  it('rejects an out-of-range RATE_LIMIT_MAX', () => {
    expect(() =>
      validateEnv({ ...validBase, RATE_LIMIT_MAX: '0' }),
    ).toThrow(
      'RATE_LIMIT_MAX must be an integer between 1 and 10000',
    );
  });

  it('rejects an out-of-range AUTH_RATE_LIMIT_MAX', () => {
    expect(() =>
      validateEnv({ ...validBase, AUTH_RATE_LIMIT_MAX: '500' }),
    ).toThrow(
      'AUTH_RATE_LIMIT_MAX must be an integer between 1 and 100',
    );
  });

  it('disables TRUST_PROXY by default', () => {
    const result = validateEnv({ ...validBase });

    expect(result.TRUST_PROXY).toBeUndefined();
    expect('TRUST_PROXY' in result).toBe(false);
  });

  it('treats an empty TRUST_PROXY as disabled', () => {
    const result = validateEnv({
      ...validBase,
      TRUST_PROXY: '  ',
    });

    expect(result.TRUST_PROXY).toBeUndefined();
  });

  it('parses a valid TRUST_PROXY hop count', () => {
    const result = validateEnv({
      ...validBase,
      TRUST_PROXY: '1',
    });

    expect(result.TRUST_PROXY).toBe(1);
  });

  it('parses a valid TRUST_PROXY address list', () => {
    const result = validateEnv({
      ...validBase,
      TRUST_PROXY: ' 10.0.0.0/8 , 192.168.1.10 , 2001:db8::/32 ',
    });

    expect(result.TRUST_PROXY).toBe(
      '10.0.0.0/8,192.168.1.10,2001:db8::/32',
    );
  });

  it('rejects a TRUST_PROXY hop count of zero', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: '0' }),
    ).toThrow(
      'TRUST_PROXY hop count must be an integer between 1 and 10',
    );
  });

  it('rejects a TRUST_PROXY hop count above the maximum', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: '11' }),
    ).toThrow(
      'TRUST_PROXY hop count must be an integer between 1 and 10',
    );
  });

  it('rejects TRUST_PROXY values that are not hop counts or addresses', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: 'true' }),
    ).toThrow(
      'TRUST_PROXY entry "true" is not a valid IP address or CIDR range',
    );
  });

  it('rejects a malformed TRUST_PROXY address', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: '999.1.1.1' }),
    ).toThrow(
      'TRUST_PROXY entry "999.1.1.1" is not a valid IP address or CIDR range',
    );
  });

  it('rejects a TRUST_PROXY CIDR with an out-of-range prefix', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: '10.0.0.0/33' }),
    ).toThrow(
      'TRUST_PROXY entry "10.0.0.0/33" is not a valid IP address or CIDR range',
    );
  });

  it('rejects TRUST_PROXY lists with empty entries', () => {
    expect(() =>
      validateEnv({ ...validBase, TRUST_PROXY: '1.2.3.4,' }),
    ).toThrow(
      'TRUST_PROXY entry "" is not a valid IP address or CIDR range',
    );
  });

  it('rejects missing required database variables', () => {
    const { DB_HOST: _host, ...withoutHost } = validBase;

    expect(() => validateEnv(withoutHost)).toThrow(
      'DB_HOST is required',
    );
  });

  it('rejects a missing JWT_SECRET', () => {
    const { JWT_SECRET: _secret, ...withoutSecret } =
      validBase;

    expect(() => validateEnv(withoutSecret)).toThrow(
      'JWT_SECRET is required',
    );
  });

  it('rejects a short JWT_SECRET in production', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
      }),
    ).toThrow(
      'JWT_SECRET must be at least 32 characters in production',
    );
  });

  it('accepts a 32+ character JWT_SECRET in production', () => {
    const result = validateEnv({
      ...validBase,
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
    });

    expect(result.NODE_ENV).toBe('production');
  });

  it('allows a shorter JWT_SECRET outside production', () => {
    const result = validateEnv({
      ...validBase,
      JWT_SECRET: 'short-but-fine-for-dev',
    });

    expect(result.JWT_SECRET).toBe(
      'short-but-fine-for-dev',
    );
  });

  it('never includes secret values in error messages', () => {
    const secretValue = 'super-secret-do-not-leak';
    const passwordValue = 'db-password-do-not-leak';

    let caught: unknown;
    try {
      validateEnv({
        DB_HOST: '',
        DB_NAME: '',
        DB_USER: '',
        DB_PASSWORD: passwordValue,
        JWT_SECRET: secretValue,
        NODE_ENV: 'production',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    const message = (caught as Error).message;
    expect(message).not.toContain(secretValue);
    expect(message).not.toContain(passwordValue);
  });

  it('rejects an invalid JWT_EXPIRY format', () => {
    expect(() =>
      validateEnv({ ...validBase, JWT_EXPIRY: '1 hour' }),
    ).toThrow(
      'JWT_EXPIRY must be a duration such as 30m, 1h, or 7d',
    );
  });

  it('accepts a valid custom JWT_EXPIRY', () => {
    const result = validateEnv({
      ...validBase,
      JWT_EXPIRY: '30m',
    });

    expect(result.JWT_EXPIRY).toBe('30m');
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      validateEnv({ ...validBase, NODE_ENV: 'staging' }),
    ).toThrow(
      'NODE_ENV must be one of: development, test, production',
    );
  });

  it('rejects malformed CORS_ORIGIN entries', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        CORS_ORIGIN: 'not-a-url, also bad',
      }),
    ).toThrow(
      'CORS_ORIGIN must be a comma-separated list of http(s) origins',
    );
  });

  it('normalizes a valid CORS_ORIGIN list', () => {
    const result = validateEnv({
      ...validBase,
      CORS_ORIGIN: 'http://localhost:3000, https://app.example.com',
    });

    expect(result.CORS_ORIGIN).toBe(
      'http://localhost:3000,https://app.example.com',
    );
  });

  it('treats an empty CORS_ORIGIN as unset', () => {
    const result = validateEnv({
      ...validBase,
      CORS_ORIGIN: '',
    });

    expect(result.CORS_ORIGIN).toBeUndefined();
  });

  it('rejects an invalid SWAGGER_ENABLED value', () => {
    expect(() =>
      validateEnv({ ...validBase, SWAGGER_ENABLED: 'maybe' }),
    ).toThrow('SWAGGER_ENABLED must be true or false');
  });

  it('defaults SWAGGER_ENABLED to false in production', () => {
    const result = validateEnv({
      ...validBase,
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
    });

    expect(result.SWAGGER_ENABLED).toBe('false');
  });

  it('normalizes SWAGGER_ENABLED=1 to true', () => {
    const result = validateEnv({
      ...validBase,
      SWAGGER_ENABLED: '1',
    });

    expect(result.SWAGGER_ENABLED).toBe('true');
  });

  it('aggregates multiple issues into one error', () => {
    let caught: unknown;
    try {
      validateEnv({});
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    const issues = (caught as EnvValidationError).issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        'DB_HOST is required',
        'DB_NAME is required',
        'DB_USER is required',
        'DB_PASSWORD is required',
        'JWT_SECRET is required',
      ]),
    );
  });
});

describe('resolveCorsOptions', () => {
  it('reflects any origin in development when unset', () => {
    expect(resolveCorsOptions('development', undefined)).toEqual(
      { origin: true, credentials: true },
    );
  });

  it('disables cross-origin requests in production when unset', () => {
    expect(resolveCorsOptions('production', undefined)).toEqual(
      { origin: false, credentials: true },
    );
  });

  it('uses the explicit origin list when configured', () => {
    expect(
      resolveCorsOptions(
        'production',
        'https://app.example.com,https://admin.example.com',
      ),
    ).toEqual({
      origin: [
        'https://app.example.com',
        'https://admin.example.com',
      ],
      credentials: true,
    });
  });
});

describe('isSwaggerEnabled', () => {
  it('is enabled by default in development', () => {
    expect(isSwaggerEnabled('development', 'true')).toBe(true);
  });

  it('is disabled by default in production', () => {
    expect(isSwaggerEnabled('production', 'false')).toBe(false);
  });

  it('can be explicitly enabled in production', () => {
    expect(isSwaggerEnabled('production', 'true')).toBe(true);
  });

  it('can be explicitly disabled in development', () => {
    expect(isSwaggerEnabled('development', 'false')).toBe(false);
  });
});
