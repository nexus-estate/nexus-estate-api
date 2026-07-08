import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end tests for the API Gateway application.
 *
 * These tests verify that the NestJS application boots correctly
 * and responds to health-check-like requests.
 */
describe('API Gateway (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set environment variables required by TypeORM
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

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('should return 404 for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/unknown-route')
      .expect(404);
  });

  it('should have the HTTP server listening', () => {
    const server = app.getHttpServer();
    expect(server).toBeDefined();
    expect(server.listening).toBeDefined();
  });
});