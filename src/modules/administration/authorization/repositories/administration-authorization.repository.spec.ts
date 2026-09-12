import { AdministrationAuthorizationRepository } from './administration-authorization.repository';

describe('AdministrationAuthorizationRepository', () => {
  it('returns the current database-backed decision', async () => {
    const query = jest.fn().mockResolvedValue([{ allowed: true }]);
    const repository = new AdministrationAuthorizationRepository({
      query,
    } as never);

    await expect(
      repository.hasPermission('admin-id', 'authorization:role:read'),
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("role.status = 'ACTIVE'"),
      ['admin-id', 'authorization:role:read'],
    );
  });

  it('denies when the current permission is absent or revoked', async () => {
    const query = jest.fn().mockResolvedValue([{ allowed: false }]);
    const repository = new AdministrationAuthorizationRepository({
      query,
    } as never);

    await expect(
      repository.hasPermission('admin-id', 'authorization:role:write'),
    ).resolves.toBe(false);
  });
});
