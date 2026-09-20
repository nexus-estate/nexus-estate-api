import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationContextResolver } from './authorization-context.resolver';

describe('AuthorizationContextResolver', () => {
  it.each<[AuthorizationPlatform, string]>([
    [AuthorizationPlatform.MARKETPLACE, 'tbl_marketplace_role'],
    [AuthorizationPlatform.PROVIDER, 'tbl_provider_role'],
    [AuthorizationPlatform.ADMINISTRATION, 'tbl_administration_role'],
  ])('resolves %s with its SQL config', (platform, roleTable) => {
    const context = new AuthorizationContextResolver().resolve(platform);

    expect(context.platform).toBe(platform);
    expect(context.config.roleTable).toBe(roleTable);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('rejects an unknown platform', () => {
    expect(() =>
      new AuthorizationContextResolver().resolve(
        'unknown' as AuthorizationPlatform,
      ),
    ).toThrow();
  });
});
