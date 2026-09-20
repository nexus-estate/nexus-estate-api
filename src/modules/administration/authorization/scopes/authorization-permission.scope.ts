import type { AuthorizationContext } from '../context/authorization-context';
import type { AuthorizationPermissionListQueryDto } from '../dto/authorization-management.dto';
import type { AuthorizationPermissionService } from '../services/permissions/authorization-permission.service';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from '../types/contracts/authorization-permission.contract';

/** Platform-bound read API for authorization permissions. */
export class AuthorizationPermissionScope {
  constructor(
    private readonly context: AuthorizationContext,
    private readonly service: AuthorizationPermissionService,
  ) {}

  /** Lists permissions from the bound platform catalogue. */
  list(
    query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    return this.service.list(this.context, query);
  }

  /** Gets one permission and its role usage from the bound platform. */
  get(permissionId: string): Promise<AuthorizationPermissionDetail> {
    return this.service.get(this.context, permissionId);
  }

  /** Lists roles that currently use a permission. */
  roles(permissionId: string): Promise<AuthorizationPermissionRolesResult> {
    return this.service.roles(this.context, permissionId);
  }
}
