import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Global module that provides a single DataSource instance for TypeORM.
 *
 * This module creates a DataSource from the configuration in `type.config.ts`
 * and provides it as a DI provider. On application shutdown, the DataSource
 * is destroyed to release database connections gracefully.
 */
@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
