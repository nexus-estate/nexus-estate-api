import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../services/abstraction-services/decorators/permissions.decorator';
import { PermissionRepository } from '../permission.repository';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Express.Request>();
    const user = request.user;
    if (!user) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED);
    }

    // Get permissions for user's role
    const permissions = await this.permissionRepository.findByRoleId(
      user.roleId,
    );

    const userPermissionNames = permissions.map((p) => p.name);

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissionNames.includes(perm),
    );

    if (!hasAllPermissions) {
      this.logger.warn(
        `User ${user.id} lacks required permissions: ${requiredPermissions.join(', ')}`,
      );
      throw new BusinessException(ErrorCodes.FORBIDDEN);
    }

    return true;
  }
}
