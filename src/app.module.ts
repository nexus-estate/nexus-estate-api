import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { typeormConfig } from './database/type.config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

/**
 * Root application module for the Nexus Estate API Gateway.
 *
 * This module is the entry point of the application and registers:
 * - **ConfigModule**: Loads `.env` file and makes configuration available globally.
 * - **TypeOrmModule**: Connects to PostgreSQL using TypeORM with configuration
 *   loaded from the `typeorm` config namespace.
 *
 * @module AppModule
 */
@Module({
  imports: [
    // Global configuration module — loads .env and registers the typeorm config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [typeormConfig],
    }),
    // Async TypeORM initialization — reads config from ConfigService
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get<TypeOrmModuleOptions>('typeorm')!,
      }),
    }),
    UserModule,
    AuthModule
  ],
})
export class AppModule {}