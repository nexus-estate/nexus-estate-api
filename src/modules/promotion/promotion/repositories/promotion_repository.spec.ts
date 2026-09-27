import { PromotionRepo } from './promotion_repository';

describe('PromotionRepo', () => {
  function createRepository(result: unknown) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    return {
      repo: new PromotionRepo(dataSource as never),
      repository,
      queryBuilder,
    };
  }

  it('returns an existing Promotion', async () => {
    const result = { id: 'promotion-id' };
    const { repo } = createRepository(result);
    await expect(repo.findById('promotion-id')).resolves.toBe(result);
  });

  it('returns null for an unknown or soft-deleted Promotion', async () => {
    const { repo } = createRepository(null);
    await expect(repo.findById('promotion-id')).resolves.toBeNull();
  });

  it('queries the primary key id and excludes soft-deleted rows', async () => {
    const { repo, repository, queryBuilder } = createRepository(null);
    await repo.findById('promotion-id');

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('promotion');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'promotion.id = :promotionId',
      { promotionId: 'promotion-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'promotion.deletedAt IS NULL',
    );
  });
});
