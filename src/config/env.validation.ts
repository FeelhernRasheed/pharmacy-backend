const NODE_ENVS = ['development', 'test', 'production'] as const;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n- ${issues.join('\n- ')}`,
    );
    this.name = 'EnvValidationError';
  }
}

function readTrimmed(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? undefined : text;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return undefined;
}

function readRaw(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];
  if (typeof value === 'string') {
    return value === '' ? undefined : value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function parsePort(
  raw: string | undefined,
  key: string,
  fallback: number,
  issues: string[],
): number {
  if (raw === undefined) {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push(`${key} must be an integer between 1 and 65535`);
    return fallback;
  }
  return port;
}

function parseBoundedInt(
  raw: string | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number,
  issues: string[],
): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    issues.push(
      `${key} must be an integer between ${min} and ${max}`,
    );
    return fallback;
  }
  return parsed;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const issues: string[] = [];
  const env: Record<string, unknown> = { ...config };

  const nodeEnv = readTrimmed(config, 'NODE_ENV') ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    issues.push(
      `NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`,
    );
  }
  env.NODE_ENV = nodeEnv;
  const isProduction = nodeEnv === 'production';

  env.PORT = parsePort(
    readTrimmed(config, 'PORT'),
    'PORT',
    3000,
    issues,
  );

  const host = readTrimmed(config, 'HOST');
  if (host !== undefined) {
    env.HOST = host;
  } else {
    delete env.HOST;
  }

  for (const key of [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ] as const) {
    const value = readTrimmed(config, key);
    if (value === undefined) {
      delete env[key];
      issues.push(`${key} is required`);
    } else {
      env[key] = value;
    }
  }

  env.DB_PORT = parsePort(
    readTrimmed(config, 'DB_PORT'),
    'DB_PORT',
    5432,
    issues,
  );

  env.DB_POOL_MAX = parseBoundedInt(
    readTrimmed(config, 'DB_POOL_MAX'),
    'DB_POOL_MAX',
    10,
    1,
    100,
    issues,
  );

  env.DB_POOL_IDLE_MS = parseBoundedInt(
    readTrimmed(config, 'DB_POOL_IDLE_MS'),
    'DB_POOL_IDLE_MS',
    30_000,
    1_000,
    600_000,
    issues,
  );

  env.DB_POOL_CONNECT_MS = parseBoundedInt(
    readTrimmed(config, 'DB_POOL_CONNECT_MS'),
    'DB_POOL_CONNECT_MS',
    5_000,
    250,
    120_000,
    issues,
  );

  const jwtSecret = readRaw(config, 'JWT_SECRET');
  if (jwtSecret === undefined) {
    delete env.JWT_SECRET;
    issues.push('JWT_SECRET is required');
  } else if (isProduction && jwtSecret.length < 32) {
    issues.push(
      'JWT_SECRET must be at least 32 characters in production',
    );
  } else {
    env.JWT_SECRET = jwtSecret;
  }

  const jwtExpiry =
    readTrimmed(config, 'JWT_EXPIRY') ?? '1h';
  if (!/^\d+[smhd]$/.test(jwtExpiry)) {
    issues.push(
      'JWT_EXPIRY must be a duration such as 30m, 1h, or 7d',
    );
  } else {
    env.JWT_EXPIRY = jwtExpiry;
  }

  const corsOrigin = readTrimmed(config, 'CORS_ORIGIN');
  if (corsOrigin !== undefined) {
    const origins = corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== '');
    const invalid = origins.some(
      (origin) => !/^https?:\/\/\S+$/.test(origin),
    );
    if (origins.length === 0 || invalid) {
      issues.push(
        'CORS_ORIGIN must be a comma-separated list of http(s) origins',
      );
    } else {
      env.CORS_ORIGIN = origins.join(',');
    }
  } else {
    delete env.CORS_ORIGIN;
  }

  const swaggerRaw = readTrimmed(config, 'SWAGGER_ENABLED');
  if (swaggerRaw === undefined) {
    env.SWAGGER_ENABLED = isProduction ? 'false' : 'true';
  } else {
    const normalized = swaggerRaw.toLowerCase();
    if (!['true', 'false', '1', '0'].includes(normalized)) {
      issues.push('SWAGGER_ENABLED must be true or false');
    } else {
      env.SWAGGER_ENABLED =
        normalized === 'true' || normalized === '1'
          ? 'true'
          : 'false';
    }
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return env;
}

export function resolveCorsOptions(
  nodeEnv: string,
  corsOrigin: string | undefined,
): { origin: string[] | boolean; credentials: boolean } {
  if (corsOrigin && corsOrigin.trim() !== '') {
    return {
      origin: corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
      credentials: true,
    };
  }

  if (nodeEnv === 'production') {
    return { origin: false, credentials: true };
  }

  return { origin: true, credentials: true };
}

export function isSwaggerEnabled(
  nodeEnv: string,
  swaggerEnabled: string | undefined,
): boolean {
  if (swaggerEnabled === 'true') {
    return true;
  }
  if (swaggerEnabled === 'false') {
    return false;
  }
  return nodeEnv !== 'production';
}
