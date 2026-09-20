export interface AuthorizationEffectiveRole {
  id: string;
  code: string;
  name: string;
}

export interface AuthorizationEffectivePermission {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface AuthorizationEffectiveResult {
  platform: 'ADMINISTRATION';
  isActive: boolean;
  roles: AuthorizationEffectiveRole[];
  permissions: AuthorizationEffectivePermission[];
  authorizationVersion: string;
}
