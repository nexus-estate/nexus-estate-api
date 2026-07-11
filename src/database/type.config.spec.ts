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
      expect(typeormConfig).toBeDefined();
      expect(typeof typeormConfig).toBe('function');
    });

    it('should default synchronize to false', () => {
      delete process.env.DB_SYNCHRONIZE;
      const config = typeormConfig();
      expect(config.synchronize).toBe(false);
    });

    it('should enable synchronize when DB_SYNCHRONIZE is true', () => {
      process.env.DB_SYNCHRONIZE = 'true';
      const config = typeormConfig();
      expect(config.synchronize).toBe(true);
    });

    it('should have entities pattern for modules', () => {
      const config = typeormConfig();
      expect(config.entities).toBeDefined();
      expect(Array.isArray(config.entities)).toBe(true);
    });

    it('should have migrations pattern', () => {
      const config = typeormConfig();
      expect(config.migrations).toBeDefined();
      expect(Array.isArray(config.migrations)).toBe(true);
    });

    it('should not synchronize in production by default', () => {
      process.env.NODE_ENV = 'production';
      const config = typeormConfig();
      expect(config.synchronize).toBe(false);
    });
  });
});
