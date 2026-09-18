import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { LeadService } from './lead.service';
import { ListingStatus } from '../../../listing/listing/entities';
import { LeadRepo } from '../repositories/lead.repo';

describe('LeadService', () => {
  const listingId = '40000000-0000-4000-8000-000000000001';

  it('creates a lead only for a published listing', async () => {
    const listingRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: listingId, status: ListingStatus.PUBLISHED }),
    };
    const saved = {
      id: '50000000-0000-4000-8000-000000000001',
      listingId,
      status: 'NEW',
      name: 'Jane',
      phone: '0900000000',
      email: null,
      message: 'Interested',
      createdAt: new Date(),
    };
    const leadRepository = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn().mockResolvedValue(saved),
    } as unknown as LeadRepo;
    const service = new LeadService(leadRepository, listingRepository as never);

    await expect(
      service.create(listingId, {
        name: ' Jane ',
        phone: ' 0900000000 ',
        message: ' Interested ',
      }),
    ).resolves.toMatchObject({ listingId, name: 'Jane', phone: '0900000000' });
    expect(listingRepository.findOne).toHaveBeenCalledWith({
      where: { id: listingId, status: ListingStatus.PUBLISHED },
    });
  });

  it('rejects a lead for an unpublished listing', async () => {
    const listingRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const leadRepository = {} as LeadRepo;
    const service = new LeadService(leadRepository, listingRepository as never);

    await expect(
      service.create(listingId, { name: 'Jane', phone: '0900000000' }),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
  });
});
