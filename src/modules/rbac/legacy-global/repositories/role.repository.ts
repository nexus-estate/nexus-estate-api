import { Injectable } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';

@Injectable()
export class RoleRepository extends BaseRepository<Role> {
  constructor(dataSource: DataSource) {
    super(dataSource, Role, 'Role');
  }

  /** Finds one legacy role by exact name. */
  async findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({
      where: {
        name,
      },
    });
  }
  /** Loads one legacy role and its mapped permissions. */
  async findByIdWithPermissions(id: string): Promise<Role | null> {
    return this.repository.findOne({
      where: {
        id,
      },
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
    });
  }
}
