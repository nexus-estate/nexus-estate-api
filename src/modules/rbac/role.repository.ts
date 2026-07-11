import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../services/abstraction-services/base.repository';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleRepository extends BaseRepository<Role> {
  constructor(dataSource: DataSource) {
    super(dataSource, Role, 'Role');
  }

  async findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({ where: { name } });
  }
}
