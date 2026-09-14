import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerModule } from '../customer/customer.module';
import { ProviderModule } from '../provider/provider.module';
import { AdministrationAuthorizationModule } from './authorization/authorization.module';
import { AdministrationTokenService } from '../../common/security/realm-token.service';
import { AdministrationAuthenticationController } from './authentication/controllers/administration-authentication.controller';
import { ProviderRegistrationAdministrationController } from './provider-review/controllers/provider-registration-administration.controller';
import { AdministrationJwtAuthGuard } from './authentication/guards/administration-jwt-auth.guard';
import { AdministrationAccountRepository } from './authentication/repositories/administration-account.repository';
import { AdministrationAuthenticationService } from './authentication/services/administration-authentication.service';
import { ProviderRegistrationAdministrationService } from './provider-review/services/provider-registration-administration.service';
import { AdministrationJwtStrategy } from './authentication/strategies/administration-jwt.strategy';
import { AdministratorAccount } from './authentication/entities/administrator-account.entity';

/** Internal administration portal boundary and its dedicated authentication. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdministratorAccount]),
    CustomerModule,
    AdministrationAuthorizationModule,
    ProviderModule,
    JwtModule.register({}),
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
    AdministrationTokenService,
  ],
  exports: [AdministrationAuthenticationService],
})
export class AdministrationModule {}
