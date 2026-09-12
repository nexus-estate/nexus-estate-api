import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from '../decorator/permission.decorator';
import type { PermissionName } from '../../../utils';
import type { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { RoleService } from '../services/role.service';

type PermissionMetadata =
  | PermissionName[]
  | {
      mode: 'all' | 'any';
      permissions: PermissionName[];
    };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<PermissionMetadata>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // A route without permission metadata is intentionally only governed by
    // authentication and any other guards declared for that route.
    const requiredPermissions = Array.isArray(metadata)
      ? metadata
      : metadata?.permissions;
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    //user in request
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedPrincipal }>();

    const user = request.user;

    if (!user) {
      return false;
    }

    //Call repository and get Role by user payload
    const role = await this.roleService.findByIdWithPermissions(user.roleId);

    const rolePermissions = new Set(
      role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    );

    return metadata && !Array.isArray(metadata) && metadata.mode === 'any'
      ? requiredPermissions.some((permission) =>
          rolePermissions.has(permission),
        )
      : requiredPermissions.every((permission) =>
          rolePermissions.has(permission),
        );
  }
}
