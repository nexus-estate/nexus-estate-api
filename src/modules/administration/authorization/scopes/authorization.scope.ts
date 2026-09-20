import type { AuthorizationContext } from '../context/authorization-context';
import { AuthorizationPermissionScope } from './authorization-permission.scope';
import { AuthorizationRoleScope } from './authorization-role.scope';
import { AuthorizationSubjectScope } from './authorization-subject.scope';
import type { AuthorizationMatrixResult } from '../types/contracts/authorization-matrix.contract';
import type { AuthorizationManagementService } from '../management/authorization-management.service';

/**
 * Immutable, platform-bound authorization API.
 *
 * A scope is created per application operation tree. Its child APIs all carry
 * the same context, so callers do not need to repeat the platform argument.
 */
export class AuthorizationScope {
  /** Role query and command operations for the bound platform. */
  readonly roles: AuthorizationRoleScope;

  /** Permission query operations for the bound platform. */
  readonly permissions: AuthorizationPermissionScope;

  /** Subject and assignment operations for the bound platform. */
  readonly subjects: AuthorizationSubjectScope;

  constructor(
    /** Bound immutable context shared by every child scope. */
    readonly context: AuthorizationContext,
    roles: AuthorizationRoleScope,
    permissions: AuthorizationPermissionScope,
    subjects: AuthorizationSubjectScope,
    private readonly managementService: AuthorizationManagementService,
  ) {
    this.roles = roles;
    this.permissions = permissions;
    this.subjects = subjects;
    Object.freeze(this);
  }

  /** Returns the deterministic role-permission matrix for the platform. */
  matrix(): Promise<AuthorizationMatrixResult> {
    return this.managementService.matrix(this.context.platform);
  }
}
