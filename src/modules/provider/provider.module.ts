import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CustomerModule } from '../customer/customer.module';
import { ProviderAccount } from './account/entities/provider-account.entity';
import { ProviderController } from './registration/controllers/provider.controller';
import { ProviderAccountController } from './account/controllers/provider-account.controller';
import { ProviderAccountRepository } from './account/repositories/provider-account.repository';
import { ProviderAccountService } from './account/services/provider-account.service';
import { ProviderAccountPolicy } from './account/helpers/provider-account.policy';
import { CurrentProviderContext } from './account/services/current-provider-context.service';
import { ProviderProfileService } from './account/services/provider-profile.service';
import { ProviderRegistrationService } from './registration/services/provider-registration.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderMembership } from './authorization/entities/provider-membership.entity';
import { ProviderRole } from './authorization/entities/provider-role.entity';
import { ProviderPermission } from './authorization/entities/provider-permission.entity';
import { ProviderRolePermission } from './authorization/entities/provider-role-permission.entity';
import { ProviderMembershipRole } from './authorization/entities/provider-membership-role.entity';
import { ProviderAuthorizationService } from './authorization/services/provider-authorization.service';

/** Owns provider registration and provider-facing API access. */
@Module({
  imports: [
    CommonModule,
    CustomerModule,
    TypeOrmModule.forFeature([
      ProviderAccount,
      ProviderMembership,
      ProviderRole,
      ProviderPermission,
      ProviderRolePermission,
      ProviderMembershipRole,
    ]),
  ],
  controllers: [ProviderController, ProviderAccountController],
  providers: [
    ProviderAccountRepository,
    ProviderAccountService,
    ProviderAccountPolicy,
    CurrentProviderContext,
    ProviderProfileService,
    ProviderRegistrationService,
    ProviderAuthorizationService,
  ],
  exports: [
    ProviderAccountRepository,
    ProviderAccountService,
    ProviderAccountPolicy,
    CurrentProviderContext,
    ProviderProfileService,
    ProviderRegistrationService,
    ProviderAuthorizationService,
  ],
})
export class ProviderModule {}
