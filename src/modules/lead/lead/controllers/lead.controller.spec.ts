import { LeadController } from './lead.controller';
import { LeadService } from '../services/lead.service';

describe('LeadController', () => {
  it('delegates a listing-scoped public lead submission', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'lead-id' }) };
    const controller = new LeadController(service as unknown as LeadService);
    const dto = { name: 'Jane', phone: '0900000000' };

    await expect(controller.create('listing-id', dto)).resolves.toEqual({
      id: 'lead-id',
    });
    expect(service.create).toHaveBeenCalledWith('listing-id', dto);
  });
});
