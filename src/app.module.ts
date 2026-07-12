import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { typeormConfig } from './database/type.config';
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuthMiddleware } from './middlewares/auth.middleware';

/**
 * Root application module for the Nexus Estate API Gateway.
 *
 * Registers:
 * - **ConfigModule**: Loads `.env` file and makes configuration available globally.
 * - **TypeOrmModule**: Connects to PostgreSQL using TypeORM.
 * - **JwtModule**: Global JWT service for middleware and token operations.
 * - **CommonModule**: Global exception filter, transform interceptor, logging interceptor.
 * - **UserModule**: User entity, service (CRUD, password management).
 * - **AuthModule**: JWT authentication (register, login, refresh token).
 * - **RbacModule**: Role-Based Access Control (roles, permissions, guards).
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
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'fallback-secret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    CommonModule,
    UserModule,
    AuthModule,
    RbacModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/register', method: RequestMethod.ALL },
        { path: 'auth/login', method: RequestMethod.ALL },
        { path: 'auth/refresh', method: RequestMethod.ALL },
        { path: 'healthz', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
