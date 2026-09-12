import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_KEY } from '../decorators/roles.decorator';
import type { RoleName } from '../../../../utils';
import type { AuthenticatedPrincipal } from '../../../../common/security/auth.types';

type RoleMetadata = RoleName[];

/** Enforces role metadata declared on controllers and route handlers. */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Returns true when the authenticated principal has one required role. */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleMetadata>(
      ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedPrincipal }>();

    const user = request.user;
    if (!user) {
      return false;
    }
    return requiredRoles.some((role) => role === user.role);
  }
}
