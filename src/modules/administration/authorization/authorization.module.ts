import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdministrationPermission } from './entities/administration-permission.entity';
import { AdministrationRolePermission } from './entities/administration-role-permission.entity';
import { AdministrationRole } from './entities/administration-role.entity';
import { AdministratorRoleAssignment } from './entities/administrator-role-assignment.entity';
import { AdministrationPermissionsGuard } from './guards/administration-permissions.guard';
import { AdministrationAuthorizationRepository } from './repositories/administration-authorization.repository';
import { AuthorizationManagementCoreService } from './services/authorization-management.service';
import { AuthorizationManagementService } from './management/authorization-management.service';
import { PlatformAuthorizationAdapterRegistry } from './management/platform-adapter.registry';
import { MarketplaceAuthorizationManagementAdapter } from './marketplace/marketplace-authorization-management.adapter';
import { ProviderAuthorizationManagementAdapter } from './provider/provider-authorization-management.adapter';
import { AdministrationAuthorizationManagementAdapter } from './administration/administration-authorization-management.adapter';
import { AuthorizationManagementController } from './controllers/authorization-management.controller';
import { AdministrationAuthorizationService } from './services/authorization-effective.service';
import { AdministrationEffectiveAuthorizationController } from './controllers/administration-effective-authorization.controller';
import { ProviderMembershipAuthorizationController } from './controllers/provider-membership-authorization.controller';
import { AuthorizationAuditRepository } from './audit/authorization-audit.repository';
import { AuthorizationAuditService } from './audit/authorization-audit.service';

/** Owns internal administration roles, permissions, and assignments. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdministrationRole,
      AdministrationPermission,
      AdministrationRolePermission,
      AdministratorRoleAssignment,
    ]),
  ],
  providers: [
    AdministrationAuthorizationRepository,
    AdministrationPermissionsGuard,
    AuthorizationManagementCoreService,
    AuthorizationAuditRepository,
    AuthorizationAuditService,
    MarketplaceAuthorizationManagementAdapter,
    ProviderAuthorizationManagementAdapter,
    AdministrationAuthorizationManagementAdapter,
    PlatformAuthorizationAdapterRegistry,
    AuthorizationManagementService,
    AdministrationAuthorizationService,
  ],
  controllers: [
    AuthorizationManagementController,
    AdministrationEffectiveAuthorizationController,
    ProviderMembershipAuthorizationController,
  ],
  exports: [
    AdministrationAuthorizationRepository,
    AdministrationPermissionsGuard,
    AuthorizationManagementService,
    AdministrationAuthorizationService,
  ],
})
export class AdministrationAuthorizationModule {}
