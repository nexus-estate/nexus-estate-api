import { registerAs } from '@nestjs/config';
import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const commonConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_POSTGRES_HOST,
  port: parseInt(process.env.DB_POSTGRES_PORT || '5432', 10),
  username: process.env.DB_POSTGRES_USER,
  password: process.env.DB_POSTGRES_PASS,
  database: process.env.DB_POSTGRES_NAME,
  namingStrategy: new SnakeNamingStrategy(),
};

const typeOrmConfig: DataSourceOptions = {
  ...commonConfig,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [__dirname + '/migrations/[0-9]*{.ts,.js}'],
  synchronize: true,  
};
export const typeormConfig = registerAs('typeorm', () => typeOrmConfig);
export default new DataSource(typeOrmConfig);