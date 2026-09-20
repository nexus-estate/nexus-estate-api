import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationSubjectService } from './authorization-subject.service';

describe('AuthorizationSubjectService', () => {
  it('routes subject listing through its repository', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const service = new AuthorizationSubjectService({ list } as never);
    const query = { page: 1, limit: 20 };

    await expect(
      service.list(AuthorizationPlatform.ADMINISTRATION, query),
    ).resolves.toEqual({ items: [], meta: { total: 0 } });
    expect(list).toHaveBeenCalledWith(
      AuthorizationPlatform.ADMINISTRATION,
      query,
    );
  });
});
