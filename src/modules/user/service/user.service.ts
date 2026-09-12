import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';
import { RoleService } from '../../rbac/services/role.service';
import { UserRepository } from '../repositories/user.repository';
import type { CreateUserInput } from '../dto/user.dto';
import type { AuthenticationUser, SafeUser } from '../types/user.type';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleService: RoleService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private prepareEmail(email: string): string {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new BusinessException(
        ErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    return normalizedEmail;
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.userRepo.findById(id);

    if (!user) {
      throw new BusinessException(ErrorCodes.USER_NOT_FOUND, id);
    }

    return user;
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const normalizedEmail = this.prepareEmail(email);

    return this.userRepo.findByEmail(normalizedEmail);
  }

  async findByEmailForAuthentication(
    email: string,
  ): Promise<AuthenticationUser | null> {
    const normalizedEmail = this.normalizeEmail(email);

    return this.userRepo.findByEmailForAuthentication(normalizedEmail);
  }

  async handleCreate(input: CreateUserInput): Promise<SafeUser> {
    const normalizedEmail = this.prepareEmail(input.email);

    if (!normalizedEmail) {
      throw new BusinessException(
        ErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    await this.roleService.findById(input.roleId);

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new BusinessException(
        ErrorCodes.USER_EMAIL_EXISTS,
        normalizedEmail,
      );
    }

    try {
      return await this.userRepo.create({
        email: normalizedEmail,
        password: input.passwordHash,
        roleId: input.roleId,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === '23505') {
          throw new BusinessException(
            ErrorCodes.USER_EMAIL_EXISTS,
            normalizedEmail,
          );
        }
      }

      throw error;
    }
  }

  async updateLastLogin(userId: string, lastLogin: Date): Promise<void> {
    const updated = await this.userRepo.updateLastLogin(userId, lastLogin);

    if (!updated) {
      throw new BusinessException(ErrorCodes.USER_NOT_FOUND, userId);
    }
  }

  /** Assigns a validated role to an active user and returns the refreshed user. */
  async updateRole(userId: string, roleId: string): Promise<SafeUser> {
    const updated = await this.userRepo.updateRole(userId, roleId);
    if (!updated) {
      throw new BusinessException(ErrorCodes.USER_NOT_FOUND, userId);
    }
    return this.findById(userId);
  }
}
