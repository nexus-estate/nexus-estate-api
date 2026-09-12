import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './legacy-global/entities/role.entity';
import { Permission } from './legacy-global/entities/permission.entity';
import { RolePermission } from './legacy-global/entities/role-permission.entity';
import { RoleRepository } from './legacy-global/repositories/role.repository';
import { PermissionRepository } from './legacy-global/repositories/permission.repository';
import { RolePermissionRepository } from './legacy-global/repositories/role-permission.repository';
import { RoleService } from './legacy-global/services/role.service';
import { PermissionService } from './legacy-global/services/permission.service';
import { RoleGuard } from './legacy-global/guards/role.guard';
import { PermissionsGuard } from './legacy-global/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  providers: [
    RoleRepository,
    PermissionRepository,
    RolePermissionRepository,
    RoleService,
    PermissionService,
    RoleGuard,
    PermissionsGuard,
  ],
  exports: [RoleService, PermissionService, RoleGuard, PermissionsGuard],
})
export class RbacModule {}
