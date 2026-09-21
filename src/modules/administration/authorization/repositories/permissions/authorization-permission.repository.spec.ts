/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { AuthorizationErrorCodes } from '../../errors/authorization-error-codes';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
} from '../../enums/authorization-platform.enum';
import { AuthorizationPermissionRepository } from './authorization-permission.repository';
import { createAuthorizationContext } from '../../context/authorization-context';

describe('AuthorizationPermissionRepository', () => {
  const marketplaceContext = createAuthorizationContext(
    AuthorizationPlatform.MARKETPLACE,
  );
  const providerContext = createAuthorizationContext(
    AuthorizationPlatform.PROVIDER,
  );
  const administrationContext = createAuthorizationContext(
    AuthorizationPlatform.ADMINISTRATION,
  );
  const permission = {
    id: 'permission-1',
    code: 'listing:read',
    name: 'Read listings',
    description: 'Can read listings',
    category: 'listing',
    resource: 'listing',
    action: 'read',
    risk_level: AuthorizationRiskLevel.HIGH,
    is_assignable: true,
    deprecated_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  };

  it('maps filtered permission rows and returns pagination metadata', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '2' }])
      .mockResolvedValueOnce([
        { ...permission, deprecated_at: new Date('2026-01-03') },
      ]);
    const repository = new AuthorizationPermissionRepository({
      query,
    } as never);
    const result = await repository.list(marketplaceContext, {
      page: 2,
      limit: 1,
      q: 'listing',
      category: 'listing',
      resource: 'listing',
      action: 'read',
      riskLevel: AuthorizationRiskLevel.HIGH,
      isAssignable: true,
      includeDeprecated: true,
      sort: 'code',
      order: 'desc',
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'permission-1',
          platform: AuthorizationPlatform.MARKETPLACE,
          riskLevel: AuthorizationRiskLevel.HIGH,
          isAssignable: true,
          isDeprecated: true,
        }),
      ],
      meta: expect.objectContaining({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      }),
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('permission.category = $2'),
      [
        '%listing%',
        'listing',
        'listing',
        'read',
        AuthorizationRiskLevel.HIGH,
        true,
      ],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/ORDER BY permission\.code DESC/),
      expect.any(Array),
    );
  });

  it('excludes deprecated permissions by default', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([]);
    const repository = new AuthorizationPermissionRepository({
      query,
    } as never);

    await repository.list(providerContext, {
      page: 1,
      limit: 20,
      includeDeprecated: false,
      sort: 'category',
      order: 'asc',
    });

    expect(query.mock.calls[0][0]).toEqual(
      expect.stringContaining('permission.deprecated_at IS NULL'),
    );
  });

  it('maps permission details and role usage, and supports roles()', async () => {
    const roles = [{ id: 'role-1', code: 'REVIEWER', name: 'Reviewer' }];
    const query = jest
      .fn()
      .mockResolvedValueOnce([permission])
      .mockResolvedValueOnce(roles);
    const repository = new AuthorizationPermissionRepository({
      query,
    } as never);

    await expect(
      repository.findById(administrationContext, 'permission-1'),
    ).resolves.toMatchObject({
      id: 'permission-1',
      rolesUsingCount: 1,
      rolesUsing: roles,
      platform: AuthorizationPlatform.ADMINISTRATION,
    });

    const rolesQuery = jest
      .fn()
      .mockResolvedValueOnce([permission])
      .mockResolvedValueOnce(roles);
    await expect(
      new AuthorizationPermissionRepository({
        query: rolesQuery,
      } as never).roles(administrationContext, 'permission-1'),
    ).resolves.toEqual({ items: roles });
  });

  it('throws PERMISSION_NOT_FOUND when the permission does not exist', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const repository = new AuthorizationPermissionRepository({
      query,
    } as never);

    await expect(
      repository.findById(marketplaceContext, 'missing'),
    ).rejects.toMatchObject({
      errorCode: AuthorizationErrorCodes.PERMISSION_NOT_FOUND.code,
    });
  });
});
