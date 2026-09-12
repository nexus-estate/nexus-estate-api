import 'reflect-metadata';
import {
  ADMINISTRATION_PERMISSION_KEY,
  AdministrationPermissionRequire,
  AnyAdministrationPermissionsRequire,
} from './administration-permission.decorator';
import { ADMINISTRATION_PERMISSIONS } from '../constants/administration-permission.constant';

describe('administration permission decorators', () => {
  it('stores an all-of requirement for one permission', () => {
    class TestController {}
    AdministrationPermissionRequire(
      ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
    )(TestController);

    expect(
      Reflect.getMetadata(ADMINISTRATION_PERMISSION_KEY, TestController),
    ).toEqual({
      mode: 'all',
      permissions: ['authorization:role:read'],
    });
  });

  it('stores an any-of requirement for delegated permissions', () => {
    class TestController {}
    AnyAdministrationPermissionsRequire(
      ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
      ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
    )(TestController);

    expect(
      Reflect.getMetadata(ADMINISTRATION_PERMISSION_KEY, TestController),
    ).toEqual({
      mode: 'any',
      permissions: ['authorization:role:read', 'authorization:permission:read'],
    });
  });
});
