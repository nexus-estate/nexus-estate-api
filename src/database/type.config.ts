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
 * - `DB_POSTGRES_USER` — Database user
 * - `DB_POSTGRES_PASS` — Database password
 * - `DB_POSTGRES_NAME` — Database name
 */
export const commonConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_POSTGRES_HOST,
  port: parseInt(process.env.DB_POSTGRES_PORT || '5432', 10),
  username: process.env.DB_POSTGRES_USER,
  password: process.env.DB_POSTGRES_PASS,
  database: process.env.DB_POSTGRES_NAME,
  namingStrategy: new SnakeNamingStrategy(),
};

/**
 * TypeORM configuration object used by the NestJS ConfigModule.
 *
 * Extends {@link commonConfig} with TypeORM-specific settings:
 * - **entities**: Glob pattern pointing to all entity files in the modules directory.
 * - **migrations**: Glob pattern pointing to migration files.
 * - **synchronize**: Disabled (`false`) for production safety — use migrations instead.
 *
 * This config is registered under the `typeorm` namespace via `registerAs`.
 */
const typeOrmConfig: DataSourceOptions = {
  ...commonConfig,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [__dirname + '/migrations/[0-9]*{.ts,.js}'],
  synchronize: false,
};

/**
 * NestJS configuration factory for the `typeorm` namespace.
 *
 * Use this with ConfigService: `configService.get('typeorm')`
 */
export const typeormConfig = registerAs('typeorm', () => typeOrmConfig);

/**
 * Standalone DataSource instance for TypeORM CLI commands (migrations).
 *
 * This is the default export and is used by TypeORM's CLI to run migrations:
 * ```
 * npx typeorm migration:run -d src/database/type.config.ts
 * ```
 */
export default new DataSource(typeOrmConfig);