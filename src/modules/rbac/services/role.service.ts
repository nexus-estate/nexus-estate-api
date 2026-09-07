import { Injectable } from '@nestjs/common';
import { RoleRepository } from '../repositories/role.repository';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import { DataSource, In } from 'typeorm';

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly rolePermissionRepository: RolePermissionRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Role> {
    const role = await this.roleRepository.findById(id);

    if (!role) {
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, id);
    }

    return role;
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findByName(name);
  }

  async findByIdWithPermissions(id: string): Promise<Role> {
    const role = await this.roleRepository.findByIdWithPermissions(id);

    if (!role) {
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, id);
    }

    return role;
  }

  async replacePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const uniquePermissionIds = [...new Set(permissionIds)];
    await this.dataSource.transaction(async (manager) => {
      const role = await manager.findOne(Role, {
        where: { id: roleId },
      });

      if (!role) {
        throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, roleId);
      }
      if (uniquePermissionIds.length > 0) {
        const permissions = await manager.find(Permission, {
          where: {
            id: In(uniquePermissionIds),
          },
        });

        const foundPermissionIds = new Set(
          permissions.map((permission) => permission.id),
        );

        const missingPermissionId = uniquePermissionIds.find(
          (permissionId) => !foundPermissionIds.has(permissionId),
        );

        if (missingPermissionId) {
          throw new BusinessException(
            ErrorCodes.PERMISSION_NOT_FOUND,
            missingPermissionId,
          );
        }
      }

      await this.rolePermissionRepository.replaceForRole(
        manager,
        roleId,
        uniquePermissionIds,
      );
    });

    return this.findByIdWithPermissions(roleId);
  }
}
