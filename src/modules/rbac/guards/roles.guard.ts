import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../services/abstraction-services/decorators/roles.decorator';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Express.Request>();
    const user = request.user;
    if (!user) throw new BusinessException(ErrorCodes.UNAUTHORIZED);

    if (!requiredRoles.includes(user.role)) {
      this.logger.warn(
        `User ${user.id} lacks required roles: ${requiredRoles.join(', ')}`,
      );
      throw new BusinessException(ErrorCodes.FORBIDDEN);
    }

    return true;
  }
}
