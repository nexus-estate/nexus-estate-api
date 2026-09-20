import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationRoleSubjectService } from './authorization-role-subject.service';
import { createAuthorizationContext } from '../../context/authorization-context';

describe('AuthorizationRoleSubjectService', () => {
  const context = createAuthorizationContext(AuthorizationPlatform.MARKETPLACE);
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
      service.listForRole(context, 'role-1', query),
    ).resolves.toEqual({ role, items, meta });

    expect(findById).toHaveBeenCalledWith(context, 'role-1');
    expect(list).toHaveBeenCalledWith(context, query, 'role-1');
  });
});
