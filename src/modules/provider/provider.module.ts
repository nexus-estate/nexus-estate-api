import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CustomerModule } from '../customer/customer.module';
import { RbacModule } from '../rbac/rbac.module';
import { ProviderAccount } from './models/provider-account.entity';
import { ProviderController } from './controllers/provider.controller';
import { ProviderAccountController } from './controllers/provider-account.controller';
import { ProviderAccountRepository } from './repositories/provider-account.repository';
import { ProviderAccountService } from './services/provider-account.service';
import { ProviderAccountPolicy } from './helpers/provider-account.policy';
import { CurrentProviderContext } from './services/current-provider-context.service';
import { ProviderProfileService } from './services/provider-profile.service';
import { ProviderRegistrationService } from './services/provider-registration.service';
import { TypeOrmModule } from '@nestjs/typeorm';

/** Owns provider registration and provider-facing API access. */
@Module({
  imports: [
    CommonModule,
    RbacModule,
    CustomerModule,
    TypeOrmModule.forFeature([ProviderAccount]),
  ],
  controllers: [ProviderController, ProviderAccountController],
  providers: [
    ProviderAccountRepository,
    ProviderAccountService,
    ProviderAccountPolicy,
    CurrentProviderContext,
    ProviderProfileService,
    ProviderRegistrationService,
  ],
  exports: [
    ProviderAccountRepository,
    ProviderAccountService,
    ProviderAccountPolicy,
    CurrentProviderContext,
    ProviderProfileService,
    ProviderRegistrationService,
  ],
})
export class ProviderModule {}
