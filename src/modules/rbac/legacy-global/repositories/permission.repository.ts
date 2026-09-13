import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly repository: Repository<Permission>,
  ) {}

  /** Finds one legacy permission by exact identifier. */
  async findById(id: string): Promise<Permission | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /** Finds one legacy permission by exact name. */
  async findByName(name: string): Promise<Permission | null> {
    return this.repository.findOne({
      where: { name },
    });
  }

  /** Loads a bounded set of legacy permissions by exact identifiers. */
  async findByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repository.find({
      where: {
        id: In(ids),
      },
    });
  }
  /** Persists one legacy permission for compatibility-only callers. */
  async create(name: string, description: string | null): Promise<Permission> {
    const permission = { name, description };
    return this.repository.save(permission);
  }
}
