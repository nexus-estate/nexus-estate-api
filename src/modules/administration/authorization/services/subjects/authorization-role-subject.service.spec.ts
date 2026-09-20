import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationRoleSubjectService } from './authorization-role-subject.service';

describe('AuthorizationRoleSubjectService', () => {
  it('returns the role together with subjects and pagination metadata', async () => {
    const role = { id: 'role-1', code: 'REVIEWER' };
    const items = [{ id: 'subject-1', displayName: 'person@example.com' }];
    const meta = { page: 2, limit: 10, total: 1 };
    const findById = jest.fn().mockResolvedValue(role);
    const list = jest.fn().mockResolvedValue({ items, meta });
    const service = new AuthorizationRoleSubjectService(
      {} as never,
      { findById } as never,
      { list } as never,
    );
    const query = { page: 2, limit: 10 };

    await expect(
      service.listForRole(AuthorizationPlatform.MARKETPLACE, 'role-1', query),
    ).resolves.toEqual({ role, items, meta });

    expect(findById).toHaveBeenCalledWith(
      AuthorizationPlatform.MARKETPLACE,
      'role-1',
    );
    expect(list).toHaveBeenCalledWith(
      AuthorizationPlatform.MARKETPLACE,
      query,
      'role-1',
    );
  });
});
