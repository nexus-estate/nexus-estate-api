import { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateService } from '../services/estate.service';
import { EstatePurpose, EstateType } from '../type/estate.type';
import { EstateController } from './estate.controller';

type EstateServiceMock = {
  createEstate: jest.MockedFunction<EstateService['createEstate']>;
  findByUserId: jest.MockedFunction<EstateService['findByUserId']>;
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
    role: 'buyer',
  };
  const request = { user };
  const estateId = '20000000-0000-4000-8000-000000000001';
  const createDto: CreateEstateDto = {
    title: 'Riverside apartment',
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: 3_500_000_000,
    addressLine: '1 Nguyen Hue',
    provinceId: '30000000-0000-4000-8000-000000000001',
    wardId: '40000000-0000-4000-8000-000000000001',
  };
  const estate = { id: estateId, userId: user.id } as Estate;

  beforeEach(() => {
    estateService = {
      createEstate: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      updateEstate: jest.fn(),
      softDeleteEstate: jest.fn(),
    };
    controller = new EstateController(
      estateService as unknown as EstateService,
    );
  });

  it('creates an estate for the authenticated principal', async () => {
    estateService.createEstate.mockResolvedValue(estate);

    await expect(controller.createEstate(request, createDto)).resolves.toBe(
      estate,
    );
    expect(estateService.createEstate).toHaveBeenCalledWith(user.id, createDto);
  });

  it('returns estates belonging to the authenticated principal', async () => {
    estateService.findByUserId.mockResolvedValue([estate]);

    await expect(controller.findEstateMine(request)).resolves.toEqual([estate]);
    expect(estateService.findByUserId).toHaveBeenCalledWith(user.id);
  });

  it('finds an estate by the route id', async () => {
    estateService.findById.mockResolvedValue(estate);

    await expect(controller.findEstateById(estateId)).resolves.toBe(estate);
    expect(estateService.findById).toHaveBeenCalledWith(estateId);
  });

  it('updates an estate using body, principal id, and route id', async () => {
    const dto: UpdateEstateDto = { title: 'Updated title' };
    estateService.updateEstate.mockResolvedValue(estate);

    await expect(controller.updateEstate(estateId, request, dto)).resolves.toBe(
      estate,
    );
    expect(estateService.updateEstate).toHaveBeenCalledWith(
      dto,
      user.id,
      estateId,
    );
  });

  it('soft-deletes an estate using principal id and route id', async () => {
    estateService.softDeleteEstate.mockResolvedValue(true);

    await expect(controller.deleteEstate(estateId, request)).resolves.toBe(
      true,
    );
    expect(estateService.softDeleteEstate).toHaveBeenCalledWith(
      user.id,
      estateId,
    );
  });
});
