import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AdministrationPrincipal } from '../../../../common/security/auth.types';
import {
  ADMINISTRATION_PERMISSION_KEY,
  type AdministrationPermissionRequirement,
} from '../decorators/administration-permission.decorator';
import { AdministrationAuthorizationRepository } from '../repositories/administration-authorization.repository';

type AdministrationRequest = Request & {
  user?: AdministrationPrincipal;
};

/** Enforces current database-backed permissions inside the administration realm. */
@Injectable()
export class AdministrationPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationRepository: AdministrationAuthorizationRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement =
      this.reflector.getAllAndOverride<AdministrationPermissionRequirement>(
        ADMINISTRATION_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requirement || requirement.permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AdministrationRequest>();
    const principal = request.user;
    if (!principal || principal.realm !== 'administration') {
      return false;
    }

    const decisions = await Promise.all(
      requirement.permissions.map((permission) =>
        this.authorizationRepository.hasPermission(principal.id, permission),
      ),
    );

    return requirement.mode === 'any'
      ? decisions.some(Boolean)
      : decisions.every(Boolean);
  }
}
