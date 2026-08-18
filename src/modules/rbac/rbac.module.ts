import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RoleRepository } from './repositories/role.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { RolePermissionRepository } from './repositories/role-permission.repository';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  providers: [
    RoleRepository,
    PermissionRepository,
    RolePermissionRepository,
    RoleService,
    PermissionService,
  ],
  exports: [RoleService, PermissionService],
})
export class RbacModule {}
