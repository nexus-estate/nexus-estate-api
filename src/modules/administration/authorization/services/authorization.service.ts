import { Injectable } from '@nestjs/common';

import { AuthorizationContextResolver } from '../context/authorization-context.resolver';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementService } from '../management/authorization-management.service';
import { AuthorizationPermissionService } from './permissions/authorization-permission.service';
import { AuthorizationRoleCommandService } from './roles/authorization-role-command.service';
import { AuthorizationRoleService } from './roles/authorization-role.service';
import { AuthorizationRoleSubjectService } from './subjects/authorization-role-subject.service';
import { AuthorizationSubjectService } from './subjects/authorization-subject.service';
import { AuthorizationPermissionScope } from '../scopes/authorization-permission.scope';
import { AuthorizationRoleScope } from '../scopes/authorization-role.scope';
import { AuthorizationScope } from '../scopes/authorization.scope';
import { AuthorizationSubjectScope } from '../scopes/authorization-subject.scope';

@Injectable()
/**
 * Application entry point for creating immutable platform authorization scopes.
 *
 * This singleton stores only stateless service dependencies. It never stores a
 * current platform, making scopes safe to use concurrently.
 */
export class AuthorizationService {
  constructor(
    private readonly contextResolver: AuthorizationContextResolver,
    private readonly roleService: AuthorizationRoleService,
    private readonly roleCommandService: AuthorizationRoleCommandService,
    private readonly permissionService: AuthorizationPermissionService,
    private readonly subjectService: AuthorizationSubjectService,
    private readonly roleSubjectService: AuthorizationRoleSubjectService,
    private readonly managementService: AuthorizationManagementService,
  ) {}

  /**
   * Creates a new authorization scope bound to one platform.
   *
   * @param platform Platform to bind to the returned scope.
   * @returns A new immutable scope whose operations use the selected platform.
   * @throws BusinessException When the platform is unsupported.
   */
  for(platform: AuthorizationPlatform): AuthorizationScope {
    const context = this.contextResolver.resolve(platform);
    return new AuthorizationScope(
      context,
      new AuthorizationRoleScope(
        context,
        this.roleService,
        this.roleCommandService,
      ),
      new AuthorizationPermissionScope(context, this.permissionService),
      new AuthorizationSubjectScope(
        context,
        this.subjectService,
        this.roleSubjectService,
      ),
      this.managementService,
    );
  }
}
