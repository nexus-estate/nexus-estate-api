import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

describe('CreateListingDto', () => {
  it('requires an existing estate UUID', async () => {
    await expect(validate(new CreateListingDto())).resolves.toHaveLength(1);

    const valid = Object.assign(new CreateListingDto(), {
      estateId: '30000000-0000-4000-8000-000000000001',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
  });
});
