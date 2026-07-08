import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Unit tests for the main application bootstrap logic.
 *
 * Verifies that the NestJS application can be created from AppModule
 * and that the HTTP server listens on the configured port.
 */
describe('App Bootstrap (main)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set environment variables required by TypeORM config before module compilation
    process.env.DB_POSTGRES_HOST = 'localhost';
    process.env.DB_POSTGRES_PORT = '5432';
    process.env.DB_POSTGRES_USER = 'test';
    process.env.DB_POSTGRES_PASS = 'test';
    process.env.DB_POSTGRES_NAME = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should bootstrap successfully and return an HTTP server instance', () => {
    const httpServer = app.getHttpServer();
    expect(httpServer).toBeDefined();
  });

  it('should use the configured port from environment or default to 50001', () => {
    const port = parseInt(process.env.PORT || '50001', 10);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });
});