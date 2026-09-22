import { PROVIDER_PERMISSION_REGISTRY } from './provider-permission.registry';

describe('provider permission registry', () => {
  it('contains the complete provider supply catalogue', () => {
    expect(
      PROVIDER_PERMISSION_REGISTRY.filter(({ code }) =>
        /^(property|listing):/.test(code),
      ).map(({ code }) => code),
    ).toEqual([
      'property:read',
      'property:create',
      'property:update',
      'property:archive',
      'listing:read',
      'listing:create',
      'listing:publish',
      'listing:archive',
    ]);
  });

  it('contains unique provider-scoped capabilities with valid metadata', () => {
    const codes = PROVIDER_PERMISSION_REGISTRY.map(
      (permission) => permission.code,
    );
    expect(new Set(codes).size).toBe(codes.length);
    for (const permission of PROVIDER_PERMISSION_REGISTRY) {
      expect(permission.platform).toBe('PROVIDER');
      expect(permission.code).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
      expect(permission.resource).toBeTruthy();
      expect(permission.action).toBeTruthy();
    }
  });
});
