import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../services/abstraction-services/base.service';
import { PermissionRepository } from '../repositories/permission.repository';
import { Permission } from '../entities/permission.entity';

export class CreatePermissionDto {
  name: string;
  description?: string;
  roleId: string;
}

export class UpdatePermissionDto {
  description?: string;
}

@Injectable()
export class PermissionService extends BaseService<
  Permission,
  CreatePermissionDto,
  UpdatePermissionDto
> {
  constructor(private readonly permissionRepository: PermissionRepository) {
    super(permissionRepository, 'Permission');
  }
}
