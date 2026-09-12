import { AdministrationEffectiveAuthorizationController } from './administration-effective-authorization.controller';

describe('AdministrationEffectiveAuthorizationController', () => {
  it('returns only the current administrator effective state', async () => {
    const effective = jest.fn().mockResolvedValue({ permissions: [] });
    const controller = new AdministrationEffectiveAuthorizationController({
      effective,
    } as never);
    await expect(
      controller.effective({
        id: 'admin-1',
        email: 'a@example.com',
        realm: 'administration',
      }),
    ).resolves.toEqual({ permissions: [] });
    expect(effective).toHaveBeenCalledWith('admin-1');
  });
});
