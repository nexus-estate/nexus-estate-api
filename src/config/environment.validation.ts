const SAFE_SECRET_MIN_LENGTH = 32;
const EXPIRY_PATTERN = /^\d+(ms|s|m|h|d|w)$/;
const ALLOWED_ENVIRONMENTS = new Set(['development', 'test', 'production']);

/** Normalizes legacy names while enforcing production security requirements. */
/** Validates and normalizes runtime configuration, failing closed for unsafe production settings. */
export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = toText(raw.NODE_ENV ?? 'development');
  if (!ALLOWED_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error(`NODE_ENV must be development, test, or production`);
  }

  const normalized = {
    ...raw,
    NODE_ENV: nodeEnv,
    PORT: parsePort(raw.PORT ?? 50001),
    TRUST_PROXY_HOPS: parseProxyHops(raw.TRUST_PROXY_HOPS ?? 0),
    CUSTOMER_JWT_ACCESS_SECRET:
      raw.CUSTOMER_JWT_ACCESS_SECRET ??
      raw.JWT_SECRET ??
      (nodeEnv === 'production'
        ? undefined
        : 'local-customer-access-secret-change-me-32'),
    CUSTOMER_JWT_REFRESH_SECRET:
      raw.CUSTOMER_JWT_REFRESH_SECRET ??
      raw.JWT_REFRESH_SECRET ??
      (nodeEnv === 'production'
        ? undefined
        : 'local-customer-refresh-secret-change-me-32'),
    // ADMIN_JWT_SECRET is a temporary access-secret alias only. It never
    // falls back to a customer secret.
    ADMIN_JWT_ACCESS_SECRET:
      raw.ADMIN_JWT_ACCESS_SECRET ??
      raw.ADMIN_JWT_SECRET ??
      (nodeEnv === 'production'
        ? undefined
        : 'local-administration-access-secret-32'),
    ADMIN_JWT_REFRESH_SECRET:
      raw.ADMIN_JWT_REFRESH_SECRET ??
      (nodeEnv === 'production'
        ? undefined
        : 'local-administration-refresh-secret-32'),
    CORS_ORIGINS:
      raw.CORS_ORIGINS ??
      raw.CORS_ORIGIN ??
      (nodeEnv === 'production'
        ? undefined
        : 'http://localhost:3000,http://localhost:5173'),
    SWAGGER_ENABLED:
      raw.SWAGGER_ENABLED ?? (nodeEnv === 'production' ? 'false' : 'true'),
    CUSTOMER_JWT_ACCESS_EXPIRES_IN:
      raw.CUSTOMER_JWT_ACCESS_EXPIRES_IN ?? raw.JWT_ACCESS_EXPIRES_IN ?? '15m',
    CUSTOMER_JWT_REFRESH_EXPIRES_IN:
      raw.CUSTOMER_JWT_REFRESH_EXPIRES_IN ?? raw.JWT_REFRESH_EXPIRES_IN ?? '7d',
    ADMIN_JWT_ACCESS_EXPIRES_IN:
      raw.ADMIN_JWT_ACCESS_EXPIRES_IN ?? raw.ADMIN_JWT_ACCESS_EXPIRES ?? '15m',
    ADMIN_JWT_REFRESH_EXPIRES_IN:
      raw.ADMIN_JWT_REFRESH_EXPIRES_IN ?? raw.ADMIN_JWT_REFRESH_EXPIRES ?? '7d',
  };

  if (nodeEnv === 'production') {
    for (const key of [
      'DB_POSTGRES_HOST',
      'DB_POSTGRES_PORT',
      'DB_POSTGRES_USER',
      'DB_POSTGRES_PASS',
      'DB_POSTGRES_NAME',
      'CUSTOMER_JWT_ACCESS_SECRET',
      'CUSTOMER_JWT_REFRESH_SECRET',
      'ADMIN_JWT_ACCESS_SECRET',
      'ADMIN_JWT_REFRESH_SECRET',
      'CORS_ORIGINS',
    ]) {
      requireValue(normalized, key);
    }
  }

  validateSecret(
    normalized.CUSTOMER_JWT_ACCESS_SECRET,
    'CUSTOMER_JWT_ACCESS_SECRET',
    nodeEnv,
  );
  validateSecret(
    normalized.CUSTOMER_JWT_REFRESH_SECRET,
    'CUSTOMER_JWT_REFRESH_SECRET',
    nodeEnv,
  );
  validateSecret(
    normalized.ADMIN_JWT_ACCESS_SECRET,
    'ADMIN_JWT_ACCESS_SECRET',
    nodeEnv,
  );
  validateSecret(
    normalized.ADMIN_JWT_REFRESH_SECRET,
    'ADMIN_JWT_REFRESH_SECRET',
    nodeEnv,
  );
  if (
    normalized.CUSTOMER_JWT_ACCESS_SECRET &&
    normalized.CUSTOMER_JWT_ACCESS_SECRET ===
      normalized.CUSTOMER_JWT_REFRESH_SECRET
  ) {
    throw new Error('Customer access and refresh secrets must differ');
  }
  if (
    normalized.ADMIN_JWT_ACCESS_SECRET &&
    normalized.ADMIN_JWT_ACCESS_SECRET === normalized.ADMIN_JWT_REFRESH_SECRET
  ) {
    throw new Error('Administration access and refresh secrets must differ');
  }

  for (const key of [
    'CUSTOMER_JWT_ACCESS_EXPIRES_IN',
    'CUSTOMER_JWT_REFRESH_EXPIRES_IN',
    'ADMIN_JWT_ACCESS_EXPIRES_IN',
    'ADMIN_JWT_REFRESH_EXPIRES_IN',
  ]) {
    if (!EXPIRY_PATTERN.test(toText(normalized[key]))) {
      throw new Error(`${key} must be a duration such as 15m or 7d`);
    }
  }

  const swaggerEnabled = toText(normalized.SWAGGER_ENABLED).toLowerCase();
  if (!['true', 'false'].includes(swaggerEnabled)) {
    throw new Error('SWAGGER_ENABLED must be true or false');
  }
  normalized.SWAGGER_ENABLED = swaggerEnabled === 'true';

  if (normalized.CORS_ORIGINS !== undefined) {
    const origins = toText(normalized.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (!origins.length || origins.some((origin) => !isAllowedOrigin(origin))) {
      throw new Error(
        'CORS_ORIGINS must be a comma-separated HTTP(S) origin allowlist',
      );
    }
    normalized.CORS_ORIGINS = origins;
  }

  return normalized;
}

function requireValue(values: Record<string, unknown>, key: string): void {
  if (
    values[key] === undefined ||
    values[key] === null ||
    toText(values[key]).trim() === ''
  ) {
    throw new Error(`${key} is required`);
  }
}

function validateSecret(value: unknown, key: string, nodeEnv: string): void {
  if (value === undefined || value === null || toText(value).trim() === '') {
    if (nodeEnv === 'production') throw new Error(`${key} is required`);
    return;
  }
  if (toText(value).length < SAFE_SECRET_MIN_LENGTH) {
    throw new Error(
      `${key} must be at least ${SAFE_SECRET_MIN_LENGTH} characters`,
    );
  }
}

function parsePort(value: unknown): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${value}`;
  return '';
}

function parseProxyHops(value: unknown): number {
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  return hops;
}

function isAllowedOrigin(origin: string): boolean {
  if (origin === '*') return false;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.pathname.slice(1)
    );
  } catch {
    return false;
  }
}
