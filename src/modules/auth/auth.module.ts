import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UserModule } from '../user/user.module';
import { AuthController } from './controller/auth.controller';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategies';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guard/jwt-auth.guard';

import { RbacModule } from '../rbac/rbac.module';
import { RoleGuard } from '../rbac/guard/role.guard';
import { PermissionsGuard } from '../rbac/guard/permission.guard';

@Module({
  imports: [
    UserModule,
    PassportModule,
    RbacModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    AuthService,
    LocalAuthGuard,
    LocalStrategy,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
