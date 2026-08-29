import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from '../decorator/permission.decorator';
import type { PermissionName } from '../../../utils';
import type { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { RoleService } from '../services/role.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionName[]
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    // check params
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

    return requiredPermissions.every((permission) =>
      rolePermissions.has(permission),
    );
  }
}
