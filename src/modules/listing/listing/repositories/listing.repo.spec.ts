import { ListingRepo } from './listing.repo';
import type { Listing } from '../entities';

describe('ListingRepo', () => {
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
