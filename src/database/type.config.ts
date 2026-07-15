import { registerAs } from '@nestjs/config';
import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Common PostgreSQL connection options shared across all TypeORM configurations.
 *
 * These options are read from environment variables at application startup.
 * The following environment variables are used:
 * - `DB_POSTGRES_HOST` — Database server hostname (default: `localhost`)
 * - `DB_POSTGRES_PORT` — Database server port (default: `5432`)
 * - `DB_POSTGRES_USER` — Database user (default: `postgres`)
 * - `DB_POSTGRES_PASS` — Database password (default: `postgres`)
 * - `DB_POSTGRES_NAME` — Database name
 */
export const commonConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.DB_POSTGRES_PORT || '5432', 10),
  username: process.env.DB_POSTGRES_USER || 'postgres',
  password: process.env.DB_POSTGRES_PASS || 'postgres',
  database: process.env.DB_POSTGRES_NAME || 'nexus_estate_dev',
  namingStrategy: new SnakeNamingStrategy(),
};

/**
 * NestJS configuration factory for the `typeorm` namespace.
 *
 * Lazily evaluates environment variables each time the config is requested,
 * enabling tests to change env vars before calling this factory.
 * Use this with ConfigService: `configService.get('typeorm')`
 */
export const typeormConfig = registerAs('typeorm', () => ({
  ...commonConfig,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [__dirname + '/migrations/[0-9]*{.ts,.js}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));

/**
 * Standalone DataSource instance for TypeORM CLI commands (migrations).
 *
 * This is the default export and is used by TypeORM's CLI to run migrations:
 * ```
 * npx typeorm migration:run -d src/database/type.config.ts
 * ```
 */
export default new DataSource({
  ...commonConfig,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [__dirname + '/migrations/[0-9]*{.ts,.js}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
});
