import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BuyerAccountModule } from '../buyer/account/buyer-account.module';
import { RbacModule } from '../rbac/rbac.module';
import { SellerPlatformModule } from '../seller-platform/seller-platform.module';
import { AdministrationAuthenticationController } from './controllers/administration-authentication.controller';
import { SellerRegistrationAdministrationController } from './controllers/seller-registration-administration.controller';
import { AdministrationJwtAuthGuard } from './guards/administration-jwt-auth.guard';
import { AdministrationAccountRepository } from './repositories/administration-account.repository';
import { AdministrationAuthenticationService } from './services/administration-authentication.service';
import { SellerRegistrationAdministrationService } from './services/seller-registration-administration.service';
import { AdministrationJwtStrategy } from './strategies/administration-jwt.strategy';
import { AdministratorAccount } from './models/administrator-account.entity';

/** Internal administration portal boundary and its dedicated authentication. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdministratorAccount]),
    BuyerAccountModule,
    RbacModule,
    SellerPlatformModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('ADMIN_JWT_SECRET') ??
          configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    AdministrationAuthenticationController,
    SellerRegistrationAdministrationController,
  ],
  providers: [
    AdministrationAccountRepository,
    AdministrationAuthenticationService,
    AdministrationJwtStrategy,
    AdministrationJwtAuthGuard,
    SellerRegistrationAdministrationService,
  ],
  exports: [AdministrationAuthenticationService],
})
export class AdministrationModule {}
