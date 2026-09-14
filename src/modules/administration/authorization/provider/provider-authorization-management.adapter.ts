import { Injectable } from '@nestjs/common';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import { MarketplaceAuthorizationManagementAdapter } from '../marketplace/marketplace-authorization-management.adapter';
import type { PlatformAuthorizationManagementPort } from '../management/platform-authorization-management.port';
import type {
  AuthorizationPermissionListQueryDto,
  AuthorizationRoleListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';

/** Provider adapter owns provider-membership subjects and provider tables. */
@Injectable()
export class ProviderAuthorizationManagementAdapter implements PlatformAuthorizationManagementPort {
  readonly platform = AuthorizationPlatform.PROVIDER;
  private readonly operations: MarketplaceAuthorizationManagementAdapter;

  constructor(core: AuthorizationManagementCoreService) {
    this.operations = new MarketplaceAuthorizationManagementAdapter(
      core,
      this.platform,
    );
  }

  listRoles(q: AuthorizationRoleListQueryDto) {
    return this.operations.listRoles(q);
  }
  getRole(id: string) {
    return this.operations.getRole(id);
  }
  createRole(d: CreateAuthorizationRoleDto, a: string, r: string | null) {
    return this.operations.createRole(d, a, r);
  }
  updateRole(
    i: string,
    d: UpdateAuthorizationRoleDto,
    a: string,
    r: string | null,
  ) {
    return this.operations.updateRole(i, d, a, r);
  }
  deleteRole(i: string, a: string, r: string | null) {
    return this.operations.deleteRole(i, a, r);
  }
  replaceRolePermissions(
    i: string,
    d: ReplaceRolePermissionsDto,
    a: string,
    r: string | null,
  ) {
    return this.operations.replaceRolePermissions(i, d, a, r);
  }
  listPermissions(q: AuthorizationPermissionListQueryDto) {
    return this.operations.listPermissions(q);
  }
  getPermission(i: string) {
    return this.operations.getPermission(i);
  }
  permissionRoles(i: string) {
    return this.operations.permissionRoles(i);
  }
  matrix() {
    return this.operations.matrix();
  }
  listSubjects(q: AuthorizationSubjectListQueryDto, r?: string) {
    return this.operations.listSubjects(q, r);
  }
  getSubject(i: string) {
    return this.operations.getSubject(i);
  }
  replaceSubjectRoles(
    i: string,
    d: ReplaceSubjectRolesDto,
    a: string,
    r: string | null,
  ) {
    return this.operations.replaceSubjectRoles(i, d, a, r);
  }
}
