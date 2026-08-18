import { Injectable } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { Permission } from '../entities/permission.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';
import { QueryFailedError } from 'typeorm';
interface CreatePermissionData {
  name: string;
  description?: string | null;
}

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepo: PermissionRepository) {}

  async findById(id: string): Promise<Permission> {
    const permission = await this.permissionRepo.findById(id);
    if (!permission)
      throw new BusinessException(ErrorCodes.PERMISSION_NOT_FOUND, id);
    return permission;
  }

  async findByName(name: string): Promise<Permission | null> {
    const normalizedName = name.trim().toLowerCase();
    return this.permissionRepo.findByName(normalizedName);
  }

  async create(data: CreatePermissionData): Promise<Permission> {
    const { name, description } = data;
    const normalizedName = name.trim().toLowerCase();
    if (normalizedName.length === 0) {
      throw new BusinessException(
        ErrorCodes.VALIDATION_ERROR,
        'Permission name is required',
      );
    }
    const existingPermission =
      await this.permissionRepo.findByName(normalizedName);

    if (existingPermission)
      throw new BusinessException(ErrorCodes.PERMISSION_EXISTS, normalizedName);
    try {
      const permission = await this.permissionRepo.create(
        normalizedName,
        description ?? null,
      );
      return permission;
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };

        if (driverError.code === '23505') {
          throw new BusinessException(
            ErrorCodes.PERMISSION_EXISTS,
            normalizedName,
          );
        }
      }
      throw error;
    }
  }
}
