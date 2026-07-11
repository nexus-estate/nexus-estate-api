import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../../services/abstraction-services/base.service';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../utils/constants/error.constant';

@Injectable()
export class RoleService extends BaseService<
  Role,
  CreateRoleDto,
  UpdateRoleDto
> {
  protected override readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {
    super(roleRepository, 'Role');
  }

  async assignPermissionToRole(
    roleId: string,
    permissionName: string,
  ): Promise<void> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, roleId);

    const existing = await this.permissionRepository.findOne({
      name: permissionName,
      roleId,
    });
    if (existing)
      throw new BusinessException(ErrorCodes.PERMISSION_EXISTS, permissionName);

    await this.permissionRepository.create({
      name: permissionName,
      roleId,
    });
    this.logger.log(`Permission ${permissionName} assigned to role ${roleId}`);
  }

  async assignPermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, roleId);

    for (const permissionId of permissionIds) {
      const permission = await this.permissionRepository.findById(permissionId);
      if (!permission)
        throw new BusinessException(
          ErrorCodes.PERMISSION_NOT_FOUND,
          permissionId,
        );
    }

    this.logger.log(
      `Assigned ${permissionIds.length} permissions to role ${roleId}`,
    );
  }

  async getRoleWithPermissions(roleId: string): Promise<Role | null> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) return null;

    const permissions = await this.permissionRepository.findByRoleId(roleId);
    (role as Role & { permissions: Permission[] }).permissions = permissions;
    return role;
  }
}
