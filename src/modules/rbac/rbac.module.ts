import { Module } from '@nestjs/common';
import { RbacController } from './controllers/rbac.controller';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { RoleRepository } from './repositories/role.repository';
import { PermissionRepository } from './repositories/permission.repository';

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
