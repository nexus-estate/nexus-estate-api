import { AuthenticatedPrincipal } from '../../../../common/security/auth.types';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateService } from '../services/estate.service';
import { EstatePurpose, EstateType } from '../types/estate.type';
import { EstateController } from './estate.controller';

type EstateServiceMock = {
  createEstate: jest.MockedFunction<EstateService['createEstate']>;
  listMine: jest.MockedFunction<EstateService['listMine']>;
  findById: jest.MockedFunction<EstateService['findById']>;
  updateEstate: jest.MockedFunction<EstateService['updateEstate']>;
  softDeleteEstate: jest.MockedFunction<EstateService['softDeleteEstate']>;
};

describe('EstateController', () => {
  let controller: EstateController;
  let estateService: EstateServiceMock;

  const user: AuthenticatedPrincipal = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'owner@nexus.test',
    roleId: '50000000-0000-4000-8000-000000000001',
    role: 'customer',
  };
  const request = { user };
  const estateId = '20000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000002';
  const createDto: CreateEstateDto = {
    title: 'Riverside apartment',
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: 3_500_000_000,
    addressLine: '1 Nguyen Hue',
    provinceId: '30000000-0000-4000-8000-000000000001',
    wardId: '40000000-0000-4000-8000-000000000001',
  };
  const estate = {
    id: estateId,
    customerId: user.id,
    providerId,
    title: 'Riverside apartment',
    description: null,
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: '3500000000',
    area: null,
    bedrooms: null,
    bathrooms: null,
    floors: null,
    addressLine: '1 Nguyen Hue',
    provinceId: '30000000-0000-4000-8000-000000000001',
    wardId: '40000000-0000-4000-8000-000000000001',
    latitude: null,
    longitude: null,
    province: {
      id: '30000000-0000-4000-8000-000000000001',
      code: '79',
      name: 'HCMC',
    },
    ward: {
      id: '40000000-0000-4000-8000-000000000001',
      code: '26734',
      name: 'Ben Nghe',
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  } as unknown as Estate;

  beforeEach(() => {
    estateService = {
      createEstate: jest.fn(),
      listMine: jest.fn(),
      findById: jest.fn(),
      updateEstate: jest.fn(),
      softDeleteEstate: jest.fn(),
    };
    controller = new EstateController(
      estateService as unknown as EstateService,
    );
  });

  it('creates an estate and maps it to the response contract', async () => {
    estateService.createEstate.mockResolvedValue(estate);

    const result = await controller.createEstate(request, createDto);

    expect(estateService.createEstate).toHaveBeenCalledWith(
      user.id,
      createDto,
      undefined,
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: estateId,
        providerId,
        title: 'Riverside apartment',
        price: 3_500_000_000,
      }),
    );
    expect(result).not.toHaveProperty('customerId');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('lists estates through the provider-scoped listMine', async () => {
    estateService.listMine.mockResolvedValue([estate]);

    const result = await controller.findEstateMine(request);

    expect(estateService.listMine).toHaveBeenCalledWith(user.id, undefined);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: estateId, providerId }),
    );
  });

  it('finds an estate by the route id and hides legacy ownership', async () => {
    estateService.findById.mockResolvedValue(estate);

    const result = await controller.findEstateById(estateId);

    expect(estateService.findById).toHaveBeenCalledWith(estateId);
    expect(result).not.toHaveProperty('customerId');
  });

  it('updates an estate using body, principal id, and route id', async () => {
    const dto: UpdateEstateDto = { title: 'Updated title' };
    estateService.updateEstate.mockResolvedValue({
      ...estate,
      title: 'Updated title',
    });

    const result = await controller.updateEstate(estateId, request, dto);

    expect(estateService.updateEstate).toHaveBeenCalledWith(
      dto,
      user.id,
      estateId,
      undefined,
    );
    expect(result.title).toBe('Updated title');
  });

  it('soft-deletes an estate using principal id and route id', async () => {
    estateService.softDeleteEstate.mockResolvedValue(true);

    await expect(controller.deleteEstate(estateId, request)).resolves.toBe(
      true,
    );
    expect(estateService.softDeleteEstate).toHaveBeenCalledWith(
      user.id,
      estateId,
      undefined,
    );
  });
});
