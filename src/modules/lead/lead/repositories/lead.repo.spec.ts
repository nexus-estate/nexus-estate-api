import { LeadRepo } from './lead.repo';
import type { Lead } from '../entities';

describe('LeadRepo', () => {
  it('delegates lead creation and persistence', async () => {
    const repository = {
      create: jest.fn((data: Partial<Lead>) => data),
      save: jest.fn().mockResolvedValue({ id: 'lead-id' }),
    };
    const repo = new LeadRepo({
      getRepository: jest.fn().mockReturnValue(repository),
    } as never);
    const lead = repo.create({ listingId: 'listing-id' });

    expect(lead).toEqual({ listingId: 'listing-id' });
    await expect(repo.save(lead as never)).resolves.toEqual({ id: 'lead-id' });
  });
});
