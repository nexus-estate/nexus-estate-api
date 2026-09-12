import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdministrationPermission } from './entities/administration-permission.entity';
import { AdministrationRolePermission } from './entities/administration-role-permission.entity';
import { AdministrationRole } from './entities/administration-role.entity';
import { AdministratorRoleAssignment } from './entities/administrator-role-assignment.entity';
import { AdministrationPermissionsGuard } from './guards/administration-permissions.guard';
import { AdministrationAuthorizationRepository } from './repositories/administration-authorization.repository';
import { AuthorizationManagementService } from './services/authorization-management.service';
import { AuthorizationManagementController } from './controllers/authorization-management.controller';
import { AuthorizationEffectiveService } from './services/authorization-effective.service';
import { AdministrationEffectiveAuthorizationController } from './controllers/administration-effective-authorization.controller';
import { ProviderMembershipAuthorizationController } from './controllers/provider-membership-authorization.controller';

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
    AuthorizationManagementService,
    AuthorizationEffectiveService,
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
    AuthorizationEffectiveService,
  ],
})
export class AdministrationAuthorizationModule {}
