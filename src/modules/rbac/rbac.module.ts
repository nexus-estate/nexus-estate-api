import { Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';

@Module({
  controllers: [RbacController],
  providers: [
    RoleService,
    PermissionService,
    RoleRepository,
    PermissionRepository,
  ],
  exports: [RoleService, PermissionService, PermissionRepository],
})
export class RbacModule {}
