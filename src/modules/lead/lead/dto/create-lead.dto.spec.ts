import { validate } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

describe('CreateLeadDto', () => {
  it('requires contact name and phone while allowing optional message fields', async () => {
    await expect(validate(new CreateLeadDto())).resolves.not.toHaveLength(0);

    const valid = Object.assign(new CreateLeadDto(), {
      name: 'Jane Doe',
      phone: '0900000000',
      email: 'jane@example.com',
      message: 'Interested',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
  });
});
