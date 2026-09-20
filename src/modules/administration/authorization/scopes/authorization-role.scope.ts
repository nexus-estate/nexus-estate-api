import type {
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  UpdateAuthorizationRoleDto,
  AuthorizationRoleListQueryDto,
} from '../dto/authorization-management.dto';
import type { AuthorizationContext } from '../context/authorization-context';
import type { AuthorizationRoleService } from '../services/roles/authorization-role.service';
import type { AuthorizationRoleCommandService } from '../services/roles/authorization-role-command.service';
import type {
  AuthorizationRoleDeletionResult,
  AuthorizationRoleDetail,
  AuthorizationRoleListResult,
} from '../types/contracts/authorization-role.contract';

/** Platform-bound API for authorization role queries and commands. */
export class AuthorizationRoleScope {
  constructor(
    private readonly context: AuthorizationContext,
    private readonly queryService: AuthorizationRoleService,
    private readonly commandService: AuthorizationRoleCommandService,
  ) {}

  /** Lists roles from the bound platform. */
  list(
    query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    return this.queryService.list(this.context, query);
  }

  /** Gets one role and its permissions from the bound platform. */
  get(roleId: string): Promise<AuthorizationRoleDetail> {
    return this.queryService.get(this.context, roleId);
  }

  /** Creates a custom role in the bound platform. */
  create(
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.commandService.create(this.context, dto, actor, requestId);
  }

  /** Updates role metadata using the caller's expected version. */
  update(
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.commandService.update(
      this.context,
      roleId,
      dto,
      actor,
      requestId,
    );
  }

  /** Soft-deletes a role when platform invariants allow deletion. */
  delete(
    roleId: string,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDeletionResult> {
    return this.commandService.delete(this.context, roleId, actor, requestId);
  }

  /** Replaces the complete permission set for a role atomically. */
  replacePermissions(
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.commandService.replacePermissions(
      this.context,
      roleId,
      dto,
      actor,
      requestId,
    );
  }
}
