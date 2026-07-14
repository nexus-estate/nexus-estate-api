import { DataPoolService } from '../../user/services/data-pool.service';
import { User } from '../../user/entities/user.entity';
import type {
  User as SdkUser,
  Role as SdkRole,
} from '@nexus-estate/typescript-sdk';

/**
 * Maps internal persistence entities to SDK response types.
 * This ensures the persistence layer (TypeORM entities with Date fields)
 * is cleanly separated from the API contract (SDK models with string fields).
 */
export class AuthResponseMapper {
  static async toSdkUser(
    user: User,
    dataPoolService: DataPoolService,
  ): Promise<SdkUser> {
    const fullName = await dataPoolService.getFullName(user.id);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: fullName ?? '',
      roleId: user.roleId,
      role: user.role ? AuthResponseMapper.toSdkRole(user.role) : undefined,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin?.toISOString() ?? null,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    };
  }

  static toSdkRole(role: User['role']): SdkRole {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt?.toISOString(),
      updatedAt: role.updatedAt?.toISOString(),
    };
  }
}
