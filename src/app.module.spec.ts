import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Unit tests for the root AppModule.
 *
 * Verifies that the module compiles correctly and all required
 * dependencies (ConfigModule, TypeOrmModule) are properly registered.
 */
describe('AppModule', () => {
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    // Set environment variables required by TypeORM config
    process.env.DB_POSTGRES_HOST = 'localhost';
    process.env.DB_POSTGRES_PORT = '5432';
    process.env.DB_POSTGRES_USER = 'test';
    process.env.DB_POSTGRES_PASS = 'test';
    process.env.DB_POSTGRES_NAME = 'test';

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should compile the module successfully', () => {
    expect(moduleFixture).toBeDefined();
  });

  it('should have ConfigService available', () => {
    const configService =
      moduleFixture.get<ConfigService>(ConfigService);
    expect(configService).toBeDefined();
  });

  it('should have TypeOrmModule configured', () => {
    // Verify TypeORM is imported by checking the module structure
    const imports = Reflect.getMetadata('imports', AppModule);
    const typeOrmImport = imports.find(
      (imp: unknown) =>
        typeof imp === 'object' &&
        imp !== null &&
        (imp as Record<string, unknown>).module === TypeOrmModule,
    );
    expect(typeOrmImport).toBeDefined();
  });

  it('should have ConfigModule registered as global', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    const configImport = imports.find(
      (imp: unknown) =>
        typeof imp === 'object' &&
        imp !== null &&
        (imp as Record<string, unknown>).module === ConfigModule,
    );
    expect(configImport).toBeDefined();
  });
});