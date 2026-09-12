import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerModule } from '../customer/customer.module';
import { RbacModule } from '../rbac/rbac.module';
import { ProviderModule } from '../provider/provider.module';
import { TokenService } from '../../common/security/token.service';
import { AdministrationAuthenticationController } from './controllers/administration-authentication.controller';
import { ProviderRegistrationAdministrationController } from './controllers/provider-registration-administration.controller';
import { AdministrationJwtAuthGuard } from './guards/administration-jwt-auth.guard';
import { AdministrationAccountRepository } from './repositories/administration-account.repository';
import { AdministrationAuthenticationService } from './services/administration-authentication.service';
import { ProviderRegistrationAdministrationService } from './services/provider-registration-administration.service';
import { AdministrationJwtStrategy } from './strategies/administration-jwt.strategy';
import { AdministratorAccount } from './models/administrator-account.entity';

/** Internal administration portal boundary and its dedicated authentication. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdministratorAccount]),
    CustomerModule,
    RbacModule,
    ProviderModule,
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
    ProviderRegistrationAdministrationController,
  ],
  providers: [
    AdministrationAccountRepository,
    AdministrationAuthenticationService,
    AdministrationJwtStrategy,
    AdministrationJwtAuthGuard,
    ProviderRegistrationAdministrationService,
    TokenService,
  ],
  exports: [AdministrationAuthenticationService],
})
export class AdministrationModule {}
