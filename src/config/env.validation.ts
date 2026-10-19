import { isIP } from 'node:net';

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

const TRUST_PROXY_MAX_HOPS = 10;

function isValidTrustProxyEntry(entry: string): boolean {
  if (entry.length === 0) {
    return false;
  }
  const parts = entry.split('/');
  if (parts.length > 2) {
    return false;
  }
  const [address, prefix] = parts;
  const family = isIP(address);
  if (family === 0) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  if (!/^\d+$/.test(prefix)) {
    return false;
  }
  const bits = Number(prefix);
  return bits <= (family === 4 ? 32 : 128);
}

// Strictly parses the optional TRUST_PROXY setting. Unset or empty
// means "disabled": forwarded headers are never trusted. Accepted
// forms:
//   - a hop count: an integer from 1 to TRUST_PROXY_MAX_HOPS
//   - a comma-separated list of IP addresses or CIDR ranges
// Anything else (e.g. "true", wildcards, malformed addresses) is
// rejected so Express can never end up trusting arbitrary clients.
function parseTrustProxy(
  raw: string | undefined,
  issues: string[],
): number | string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (hops < 1 || hops > TRUST_PROXY_MAX_HOPS) {
      issues.push(
        `TRUST_PROXY hop count must be an integer between 1 and ${TRUST_PROXY_MAX_HOPS}`,
      );
      return undefined;
    }
    return hops;
  }

  const validEntries: string[] = [];
  for (const entry of raw.split(',').map((part) => part.trim())) {
    if (isValidTrustProxyEntry(entry)) {
      validEntries.push(entry);
    } else {
      issues.push(
        `TRUST_PROXY entry "${entry}" is not a valid IP address or CIDR range`,
      );
    }
  }

  if (validEntries.length === 0) {
    return undefined;
  }
  return validEntries.join(',');
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

  env.RATE_LIMIT_MAX = parseBoundedInt(
    readTrimmed(config, 'RATE_LIMIT_MAX'),
    'RATE_LIMIT_MAX',
    100,
    1,
    10_000,
    issues,
  );

  env.RATE_LIMIT_TTL = parseBoundedInt(
    readTrimmed(config, 'RATE_LIMIT_TTL'),
    'RATE_LIMIT_TTL',
    60,
    1,
    3_600,
    issues,
  );

  env.AUTH_RATE_LIMIT_MAX = parseBoundedInt(
    readTrimmed(config, 'AUTH_RATE_LIMIT_MAX'),
    'AUTH_RATE_LIMIT_MAX',
    10,
    1,
    100,
    issues,
  );

  env.AUTH_RATE_LIMIT_TTL = parseBoundedInt(
    readTrimmed(config, 'AUTH_RATE_LIMIT_TTL'),
    'AUTH_RATE_LIMIT_TTL',
    60,
    1,
    3_600,
    issues,
  );

  // Optional and disabled by default: X-Forwarded-For stays
  // untrusted unless TRUST_PROXY is explicitly configured.
  const trustProxy = parseTrustProxy(
    readTrimmed(config, 'TRUST_PROXY'),
    issues,
  );
  if (trustProxy === undefined) {
    delete env.TRUST_PROXY;
  } else {
    env.TRUST_PROXY = trustProxy;
  }

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
