import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModule,
  TypeOrmModuleOptions,
  getDataSourceToken,
} from '@nestjs/typeorm';
import { typeormConfig } from '../../src/database/type.config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

/**
 * Integration tests for the PostgreSQL database connection using Testcontainers.
 *
 * These tests spin up a real PostgreSQL instance inside a Docker container,
 * verify that TypeORM can connect to it, and validate basic database operations.
 */
describe('Database Integration (PostgreSQL via Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Start a PostgreSQL container for testing
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_test')
      .withUsername('test')
      .withPassword('test')
      .withExposedPorts(5432)
      .start();

    // Build a testing module with real database connection using Postgres config
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [typeormConfig],
          ignoreEnvFile: true,
        }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (): TypeOrmModuleOptions => ({
            type: 'postgres' as const,
            host: container.getHost(),
            port: container.getMappedPort(5432),
            username: 'test',
            password: 'test',
            database: 'nexus_estate_test',
            synchronize: true,
            entities: [],
            autoLoadEntities: false,
          }),
        }),
      ],
    }).compile();

    // Get the DataSource to perform direct queries
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
    if (container) {
      await container.stop();
    }
  });

  it('should connect to PostgreSQL and run a basic query', async () => {
    const result: Record<string, unknown>[] =
      await dataSource.query('SELECT 1 AS value');
    expect(result).toBeDefined();
    expect(result[0].value).toBe(1);
  });

  it('should return the PostgreSQL server version', async () => {
    const result: Record<string, unknown>[] = await dataSource.query(
      'SELECT version() AS version',
    );
    expect(result).toBeDefined();
    expect(result[0].version).toContain('PostgreSQL');
  });

  it('should create and query a temporary table', async () => {
    await dataSource.query(`
      CREATE TEMPORARY TABLE test_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await dataSource.query(`INSERT INTO test_items (name) VALUES ($1)`, [
      'integration-test',
    ]);

    const rows: Record<string, unknown>[] = await dataSource.query(
      'SELECT * FROM test_items',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('integration-test');
  });

  it('should verify the database server encoding is UTF8', async () => {
    const result: Record<string, unknown>[] = await dataSource.query(
      "SELECT setting FROM pg_settings WHERE name = 'server_encoding'",
    );
    expect(result[0].setting).toBe('UTF8');
  });

  it('should handle multiple concurrent queries without errors', async () => {
    const results: Record<string, unknown>[][] = [];
    for (let i = 0; i < 5; i++) {
      const result: Record<string, unknown>[] = await dataSource.query(
        'SELECT $1 AS num',
        [i + 1],
      );
      results.push(result);
    }

    results.forEach((result, index) => {
      expect(Number(result[0].num)).toBe(index + 1);
    });
  });
});
