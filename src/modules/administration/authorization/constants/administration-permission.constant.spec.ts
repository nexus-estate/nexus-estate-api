import { ADMINISTRATION_PERMISSIONS } from './administration-permission.constant';

describe('ADMINISTRATION_PERMISSIONS', () => {
  it('contains the scoped management capabilities', () => {
    expect(ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ).toBe(
      'authorization:role:read',
    );
    expect(ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE).toBe(
      'authorization:role:write',
    );
    expect(ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_WRITE).toBe(
      'authorization:assignment:write',
    );
  });

  it('does not define customer or provider identity roles', () => {
    expect(Object.keys(ADMINISTRATION_PERMISSIONS)).not.toEqual(
      expect.arrayContaining(['CUSTOMER', 'PROVIDER', 'ADMINISTRATOR']),
    );
  });
});
