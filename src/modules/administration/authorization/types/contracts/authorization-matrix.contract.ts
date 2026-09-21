export interface AuthorizationMatrixRoleReference {
  id: string;
  code: string;
  name: string;
}

export interface AuthorizationMatrixPermission {
  id: string;
  code: string;
  name: string;
  riskLevel: string;
}

export interface AuthorizationMatrixPermissionGroup {
  category: string;
  permissions: AuthorizationMatrixPermission[];
}

export interface AuthorizationMatrixResult {
  roles: AuthorizationMatrixRoleReference[];
  permissionGroups: AuthorizationMatrixPermissionGroup[];
  assignments: Record<string, string[]>;
}
