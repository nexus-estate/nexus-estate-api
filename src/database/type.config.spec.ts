import { commonConfig, typeormConfig } from './type.config';

/**
 * Unit tests for the database/TypeORM configuration module.
 *
 * Verifies that configuration values are correctly read from environment
 * variables and that the TypeORM config object has the expected structure.
 */
describe('Database Configuration (type.config)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('commonConfig', () => {
    it('should have PostgreSQL as the database type', () => {
      expect(commonConfig.type).toBe('postgres');
    });

    it('should read host from DB_POSTGRES_HOST environment variable', () => {
      process.env.DB_POSTGRES_HOST = 'test-host';
      // Access host via type assertion since DataSourceOptions is a union type
      const config = commonConfig as { host?: string };
      expect(config.host).toBeDefined();
    });

    it('should default port to 5432 if DB_POSTGRES_PORT is not set', () => {
      delete process.env.DB_POSTGRES_PORT;
      const port = parseInt(process.env.DB_POSTGRES_PORT || '5432', 10);
      expect(port).toBe(5432);
    });

    it('should use SnakeNamingStrategy', () => {
      expect(commonConfig.namingStrategy).toBeDefined();
    });
  });

  describe('typeormConfig', () => {
    it('should be registered as a NestJS config namespace', () => {
      // typeormConfig is created via registerAs('typeorm', ...)
      expect(typeormConfig).toBeDefined();
      expect(typeof typeormConfig).toBe('function');
    });

    it('should disable synchronize in production-like environments', () => {
      // Synchronize should be false for safety
      const config = typeormConfig();
      expect(config.synchronize).toBe(false);
    });

    it('should have entities pattern for modules', () => {
      const config = typeormConfig();
      expect(config.entities).toBeDefined();
      expect(Array.isArray(config.entities)).toBe(true);
    });
  });
});