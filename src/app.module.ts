import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { typeormConfig } from './database/type.config';
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RolesGuard } from './modules/rbac/guards/roles.guard';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard';

/**
 * Root application module for the Nexus Estate API Gateway.
 *
 * Registers:
 * - **ConfigModule**: Loads `.env` file and makes configuration available globally.
 * - **TypeOrmModule**: Connects to PostgreSQL using TypeORM.
 * - **CommonModule**: Global exception filter, transform interceptor, logging interceptor.
 * - **UserModule**: User entity, service (CRUD, password management).
 * - **AuthModule**: JWT authentication (register, login, refresh token).
 * - **RbacModule**: Role-Based Access Control (roles, permissions, global guards).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [typeormConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get<TypeOrmModuleOptions>('typeorm')!,
        autoLoadEntities: true,
      }),
    }),
    CommonModule,
    UserModule,
    AuthModule,
    RbacModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
