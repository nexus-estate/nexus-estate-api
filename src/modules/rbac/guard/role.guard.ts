import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_KEY } from '../decorator/roles.decorator';
import { RoleName } from '../../../utils';
import { AuthenticatedPrincipal } from '../../auth/types/auth.type';

@Injectable()
export class RoleGurad implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requireRole = this.reflector.getAllAndOverride<RoleName[]>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireRole || requireRole.length == 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedPrincipal }>();

    const user = request.user;
    if (!user) {
      return false;
    }
    return requireRole.some((role) => role === user.role);
  }
}
