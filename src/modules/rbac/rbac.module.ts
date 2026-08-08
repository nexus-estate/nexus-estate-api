import { Module } from '@nestjs/common';
import { RbacController } from './controllers/rbac.controller';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { RoleRepository } from './repositories/role.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
@Module({
  controllers: [RbacController],
  providers: [
    RoleService,
    PermissionService,
    RoleRepository,
    PermissionRepository,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [RoleService, PermissionService, PermissionRepository],
})
export class RbacModule {}
