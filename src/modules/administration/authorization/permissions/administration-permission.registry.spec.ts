import { ADMINISTRATION_PERMISSION_REGISTRY } from './administration-permission.registry';

describe('administration permission registry', () => {
  it('has unique codes with complete semantic metadata', () => {
    const codes = ADMINISTRATION_PERMISSION_REGISTRY.map(
      (permission) => permission.code,
    );
    expect(new Set(codes).size).toBe(codes.length);
    for (const permission of ADMINISTRATION_PERMISSION_REGISTRY) {
      expect(permission.platform).toBe('ADMINISTRATION');
      expect(permission.resource).toBeTruthy();
      expect(permission.action).toBeTruthy();
      expect(permission.category).toBeTruthy();
      expect(permission.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
    }
  });
});
