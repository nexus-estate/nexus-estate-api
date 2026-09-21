import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationSubjectService } from './authorization-subject.service';
import { createAuthorizationContext } from '../../context/authorization-context';

describe('AuthorizationSubjectService', () => {
  const context = createAuthorizationContext(
    AuthorizationPlatform.ADMINISTRATION,
  );
  it('routes subject listing through its repository', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const service = new AuthorizationSubjectService({ list } as never);
    const query = { page: 1, limit: 20 };

    await expect(service.list(context, query)).resolves.toEqual({
      items: [],
      meta: { total: 0 },
    });
    expect(list).toHaveBeenCalledWith(context, query);
  });
});
