import { validateEnvironment } from './environment.validation';

const baseProductionEnvironment = {
  NODE_ENV: 'production',
  PORT: '50001',
  DB_POSTGRES_HOST: 'postgres',
  DB_POSTGRES_PORT: '5432',
  DB_POSTGRES_USER: 'nexus',
  DB_POSTGRES_PASS: 'database-password',
  DB_POSTGRES_NAME: 'nexus_estate',
  CUSTOMER_JWT_ACCESS_SECRET: 'customer-access-secret-which-is-long-enough-32',
  CUSTOMER_JWT_REFRESH_SECRET:
    'customer-refresh-secret-which-is-long-enough-32',
  ADMIN_JWT_ACCESS_SECRET: 'admin-access-secret-which-is-long-enough-32',
  ADMIN_JWT_REFRESH_SECRET: 'admin-refresh-secret-which-is-long-enough-32',
  CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
  SWAGGER_ENABLED: 'false',
};

describe('validateEnvironment', () => {
  it('requires independent administration secrets in production', () => {
    const environment: Record<string, unknown> = {
      ...baseProductionEnvironment,
    };
    delete environment.ADMIN_JWT_ACCESS_SECRET;

    expect(() => validateEnvironment(environment)).toThrow(
      'ADMIN_JWT_ACCESS_SECRET is required',
    );
  });

  it('does not accept a wildcard production CORS origin', () => {
    expect(() =>
      validateEnvironment({ ...baseProductionEnvironment, CORS_ORIGINS: '*' }),
    ).toThrow('CORS_ORIGINS');
  });

  it('rejects malformed token expiry configuration', () => {
    expect(() =>
      validateEnvironment({
        ...baseProductionEnvironment,
        CUSTOMER_JWT_ACCESS_EXPIRES_IN: 'forever',
      }),
    ).toThrow('CUSTOMER_JWT_ACCESS_EXPIRES_IN');
  });

  it('normalizes safe development defaults and legacy aliases', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'development',
      JWT_SECRET: 'legacy-customer-access-secret-which-is-long-enough-32',
      JWT_REFRESH_SECRET:
        'legacy-customer-refresh-secret-which-is-long-enough-32',
    });

    expect(environment.CUSTOMER_JWT_ACCESS_SECRET).toBe(
      'legacy-customer-access-secret-which-is-long-enough-32',
    );
    expect(environment.ADMIN_JWT_ACCESS_SECRET).not.toBe(
      environment.CUSTOMER_JWT_ACCESS_SECRET,
    );
    expect(environment.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
    ]);
  });
});
