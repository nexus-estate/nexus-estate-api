import { Injectable } from '@nestjs/common';

import type { AuthorizationPermissionListQueryDto } from '../../dto/authorization-management.dto';
import type { AuthorizationContext } from '../../context/authorization-context';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from '../../types/contracts/authorization-permission.contract';
import { AuthorizationPermissionRepository } from '../../repositories/permissions/authorization-permission.repository';

@Injectable()
/** Stateless permission query service operating on explicit contexts. */
export class AuthorizationPermissionService {
  constructor(private readonly repository: AuthorizationPermissionRepository) {}

  /** Lists permissions for a platform context. */
  list(
    context: AuthorizationContext,
    query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    return this.repository.list(context, query);
  }

  /** Loads one permission and its role usage. */
  get(
    context: AuthorizationContext,
    permissionId: string,
  ): Promise<AuthorizationPermissionDetail> {
    return this.repository.findById(context, permissionId);
  }

  /** Lists roles that use a permission in the selected platform. */
  roles(
    context: AuthorizationContext,
    permissionId: string,
  ): Promise<AuthorizationPermissionRolesResult> {
    return this.repository.roles(context, permissionId);
  }
}
