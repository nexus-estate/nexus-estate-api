import { ListingPromotionRepo } from './listingPromotion.repo';

describe('ListingPromotionRepo', () => {
  it('queries only active promotions of the requested listing using half-open overlap rules', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const repo = new ListingPromotionRepo(dataSource as never);
    const startAt = new Date('2026-01-07T00:00:00.000Z');
    const endAt = new Date('2026-01-10T00:00:00.000Z');

    await expect(
      repo.findOverlappingByListingId('listing-a', startAt, endAt),
    ).resolves.toBeNull();

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('promotion');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'promotion.listingId = :listingId',
      { listingId: 'listing-a' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'promotion.deletedAt IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'promotion.startAt < :endAt',
      { endAt },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      'promotion.endAt > :startAt',
      { startAt },
    );
  });
});
