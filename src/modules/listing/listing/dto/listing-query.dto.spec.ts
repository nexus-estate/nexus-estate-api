import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListingQueryDto } from './listing-query.dto';

describe('ListingQueryDto', () => {
  it('accepts backend enum values and converts pagination numbers', async () => {
    const query = plainToInstance(ListingQueryDto, {
      type: 'APARTMENT',
      purpose: 'SALE',
      page: '2',
      limit: '10',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
  });

  it('rejects UI-only lowercase enum aliases', async () => {
    const query = plainToInstance(ListingQueryDto, { type: 'apartment' });
    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});
