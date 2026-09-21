/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AuthorizationErrorCodes } from '../../errors/authorization-error-codes';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
} from '../../enums/authorization-platform.enum';
import { AuthorizationSubjectRepository } from './authorization-subject.repository';
import { createAuthorizationContext } from '../../context/authorization-context';

describe('AuthorizationSubjectRepository', () => {
  const marketplaceContext = createAuthorizationContext(
    AuthorizationPlatform.MARKETPLACE,
  );
  const providerContext = createAuthorizationContext(
    AuthorizationPlatform.PROVIDER,
  );
  const administrationContext = createAuthorizationContext(
    AuthorizationPlatform.ADMINISTRATION,
  );
  it('maps Marketplace subjects and Administration status values', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'customer-1',
          display_name: 'customer@example.com',
          secondary_text: 'customer@example.com',
          status: 'ACTIVE',
          role_count: 2,
          role_ids: ['role-1', 'role-2'],
        },
      ]);
    const repository = new AuthorizationSubjectRepository({ query } as never);

    await expect(
      repository.list(marketplaceContext, {
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'customer-1',
          subjectType: 'CUSTOMER',
          status: 'ACTIVE',
          roleCount: 2,
          roleIds: ['role-1', 'role-2'],
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const adminQuery = jest
      .fn()
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'administrator-1',
          display_name: 'admin@example.com',
          secondary_text: 'admin@example.com',
          status: 'DISABLED',
          role_count: 0,
          role_ids: [],
        },
      ]);
    await expect(
      new AuthorizationSubjectRepository({ query: adminQuery } as never).list(
        administrationContext,
        { page: 1, limit: 20 },
      ),
    ).resolves.toMatchObject({ items: [{ status: 'DISABLED' }] });
  });

  it('uses provider joins and roleId filtering when listing subjects', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([]);
    const repository = new AuthorizationSubjectRepository({ query } as never);

    await repository.list(
      providerContext,
      { page: 1, limit: 20, q: 'provider', status: 'ACTIVE' },
      'role-1',
    );

    expect(query.mock.calls[0][0]).toEqual(
      expect.stringContaining('INNER JOIN tbl_provider_account provider'),
    );
    expect(query.mock.calls[0][0]).toEqual(
      expect.stringContaining(
        'EXISTS (SELECT 1 FROM tbl_provider_membership_role',
      ),
    );
    expect(query.mock.calls[0][1]).toEqual(['%provider%', 'ACTIVE', 'role-1']);
    expect(query.mock.calls[1][0]).toEqual(
      expect.stringContaining('provider.display_name AS display_name'),
    );
  });

  it('maps subject details, roles, permissions, and provider enrichment', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'membership-1',
          display_name: 'Provider One',
          secondary_text: 'customer@example.com',
          status: 'ACTIVE',
          role_count: 1,
          role_ids: ['role-1'],
        },
      ])
      .mockResolvedValueOnce([
        { id: 'role-1', code: 'AGENT', name: 'Agent', status: 'ACTIVE' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'listing:read',
          name: 'Read listings',
          description: null,
          category: 'listing',
          resource: 'listing',
          action: 'read',
          risk_level: AuthorizationRiskLevel.LOW,
          is_assignable: true,
          deprecated_at: null,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        },
      ])
      .mockResolvedValueOnce([
        {
          provider_id: 'provider-1',
          provider_display_name: 'Provider One',
          customer_id: 'customer-1',
          customer_email: 'customer@example.com',
        },
      ]);
    const repository = new AuthorizationSubjectRepository({ query } as never);

    await expect(
      repository.findById(providerContext, 'membership-1'),
    ).resolves.toMatchObject({
      id: 'membership-1',
      subjectType: 'PROVIDER_MEMBERSHIP',
      roles: [{ code: 'AGENT' }],
      permissions: [
        { code: 'listing:read', riskLevel: AuthorizationRiskLevel.LOW },
      ],
      provider_id: 'provider-1',
      provider_display_name: 'Provider One',
      customer_id: 'customer-1',
      customer_email: 'customer@example.com',
    });
  });

  it('throws SUBJECT_NOT_FOUND when the subject does not exist', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const repository = new AuthorizationSubjectRepository({ query } as never);

    await expect(
      repository.findById(administrationContext, 'missing'),
    ).rejects.toMatchObject({
      errorCode: AuthorizationErrorCodes.SUBJECT_NOT_FOUND.code,
    });
  });
});
