import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
  AuthorizationRoleStatus,
} from './authorization-platform.enum';

describe('authorization platform enums', () => {
  it('keeps platform contexts explicit and independent', () => {
    expect(Object.values(AuthorizationPlatform)).toEqual([
      'MARKETPLACE',
      'PROVIDER',
      'ADMINISTRATION',
    ]);
  });

  it('exposes the supported role status and risk values', () => {
    expect(Object.values(AuthorizationRoleStatus)).toEqual([
      'ACTIVE',
      'DISABLED',
    ]);
    expect(Object.values(AuthorizationRiskLevel)).toEqual([
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL',
    ]);
  });
});
