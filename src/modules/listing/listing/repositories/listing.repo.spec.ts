import { ListingRepo } from './listing.repo';
import type { Listing } from '../entities';

describe('ListingRepo', () => {
  it('selects only published active estates in a current promotion window', async () => {
    const rows = [{ id: 'promoted-listing' }];
    const query = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const repository = {
      manager: { getRepository: jest.fn() },
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    repository.manager.getRepository.mockReturnValue(repository);
    const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
    const repo = new ListingRepo(dataSource as never);

    await expect(repo.findPromoted()).resolves.toBe(rows);
    expect(query.andWhere).toHaveBeenCalledWith('listing.status = :status', {
      status: 'PUBLISHED',
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'estate.status = :estateStatus',
      {
        estateStatus: 'ACTIVE',
      },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('listing_promotion.start_at <= NOW()'),
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('listing_promotion.end_at > NOW()'),
    );
    expect(query.take).toHaveBeenCalledWith(8);
  });

  it('delegates persistence primitives to the feature repository', async () => {
    const repository = {
      create: jest.fn((data: Partial<Listing>) => data),
      save: jest.fn().mockResolvedValue({ id: 'listing-id' }),
    };
    const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
    const repo = new ListingRepo(dataSource as never);
    const listing = repo.create({ estateId: 'estate-id' });

    expect(listing).toEqual({ estateId: 'estate-id' });
    await expect(repo.save(listing as never)).resolves.toEqual({
      id: 'listing-id',
    });
    expect(repository.save).toHaveBeenCalledWith(listing);
  });
});
