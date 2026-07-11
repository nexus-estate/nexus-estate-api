import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../services/abstraction-services/base.repository';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionRepository extends BaseRepository<Permission> {
  constructor(dataSource: DataSource) {
    super(dataSource, Permission, 'Permission');
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.repository.findOne({ where: { name } });
  }

  async findByRoleId(roleId: string): Promise<Permission[]> {
    return this.repository.find({ where: { roleId } });
  }
}
