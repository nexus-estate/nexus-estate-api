import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class RolePermissionRepository {
  constructor(
    @InjectRepository(RolePermission)
    private readonly repository: Repository<RolePermission>,
  ) {}

  async findByRoleId(roleId: string): Promise<RolePermission[]> {
    return this.repository.find({
      where: { roleId },
      relations: {
        permission: true,
      },
    });
  }

  async replaceForRole(
    manager: EntityManager,
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    const repository = manager.getRepository(RolePermission);

    await repository.delete({ roleId });

    if (permissionIds.length === 0) {
      return;
    }

    const rolePermissions = permissionIds.map((permissionId) =>
      repository.create({
        roleId,
        permissionId,
      }),
    );

    await repository.insert(rolePermissions);
  }
}
