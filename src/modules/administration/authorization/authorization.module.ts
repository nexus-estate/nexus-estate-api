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
import { AuthorizationManagementController } from './controllers/authorization-management.controller';
import { AdministrationAuthorizationService } from './services/authorization-effective.service';
import { AdministrationEffectiveAuthorizationController } from './controllers/administration-effective-authorization.controller';
import { ProviderMembershipAuthorizationController } from './controllers/provider-membership-authorization.controller';
import { AuthorizationAuditRepository } from './audit/authorization-audit.repository';
import { AuthorizationAuditService } from './audit/authorization-audit.service';
import { AuthorizationRoleRepository } from './repositories/roles/authorization-role.repository';
import { AuthorizationRoleService } from './services/roles/authorization-role.service';
import { AuthorizationPermissionRepository } from './repositories/permissions/authorization-permission.repository';
import { AuthorizationPermissionService } from './services/permissions/authorization-permission.service';
import { AuthorizationSubjectRepository } from './repositories/subjects/authorization-subject.repository';
import { AuthorizationSubjectService } from './services/subjects/authorization-subject.service';
import { AuthorizationRoleCommandService } from './services/roles/authorization-role-command.service';
import { AuthorizationRoleSubjectService } from './services/subjects/authorization-role-subject.service';
import { AuthorizationProviderMembershipService } from './services/subjects/authorization-provider-membership.service';
import { AuthorizationAuditQueryService } from './audit/authorization-audit-query.service';
import { AuthorizationContextResolver } from './context/authorization-context.resolver';
import { AuthorizationService } from './services/authorization.service';

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
    AuthorizationRoleRepository,
    AuthorizationRoleService,
    AuthorizationPermissionRepository,
    AuthorizationPermissionService,
    AuthorizationSubjectRepository,
    AuthorizationSubjectService,
    AuthorizationRoleCommandService,
    AuthorizationRoleSubjectService,
    AuthorizationProviderMembershipService,
    AuthorizationAuditQueryService,
    AuthorizationContextResolver,
    AuthorizationService,
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
    AdministrationAuthorizationService,
  ],
})
export class AdministrationAuthorizationModule {}
