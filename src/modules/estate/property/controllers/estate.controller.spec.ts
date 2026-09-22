import { AuthenticatedPrincipal } from '../../../../common/security/auth.types';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateService } from '../services/estate.service';
import { EstatePurpose, EstateType } from '../types/estate.type';
import { EstateStatus } from '../types/estate.type';
import { EstateController } from './estate.controller';

const API_RESPONSE_METADATA = 'swagger/apiResponse';

type EstateServiceMock = {
  createEstate: jest.MockedFunction<EstateService['createEstate']>;
  listMine: jest.MockedFunction<EstateService['listMine']>;
  findPublicById: jest.MockedFunction<EstateService['findPublicById']>;
  findOwnedByIdForUpdate: jest.MockedFunction<
    EstateService['findOwnedByIdForUpdate']
  >;
  updateEstate: jest.MockedFunction<EstateService['updateEstate']>;
  softDeleteEstate: jest.MockedFunction<EstateService['softDeleteEstate']>;
  activateEstate: jest.MockedFunction<EstateService['activateEstate']>;
  archiveEstate: jest.MockedFunction<EstateService['archiveEstate']>;
  restoreEstate: jest.MockedFunction<EstateService['restoreEstate']>;
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
    status: EstateStatus.DRAFT,
  } as unknown as Estate;

  beforeEach(() => {
    estateService = {
      createEstate: jest.fn(),
      listMine: jest.fn(),
      findPublicById: jest.fn(),
      findOwnedByIdForUpdate: jest.fn(),
      updateEstate: jest.fn(),
      softDeleteEstate: jest.fn(),
      activateEstate: jest.fn(),
      archiveEstate: jest.fn(),
      restoreEstate: jest.fn(),
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
    estateService.findPublicById.mockResolvedValue(estate);

    const result = await controller.findEstateById(estateId);

    expect(estateService.findPublicById).toHaveBeenCalledWith(estateId);
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

  it('activates an estate through the explicit command route', async () => {
    estateService.activateEstate.mockResolvedValue({
      ...estate,
      status: EstateStatus.ACTIVE,
    });

    const result = await controller.activateEstate(estateId, request);

    expect(estateService.activateEstate).toHaveBeenCalledWith(
      user.id,
      estateId,
      undefined,
    );
    expect(result.status).toBe(EstateStatus.ACTIVE);
  });

  it('archives and restores through explicit command routes', async () => {
    estateService.archiveEstate.mockResolvedValue({
      ...estate,
      status: EstateStatus.ARCHIVED,
    });
    estateService.restoreEstate.mockResolvedValue({
      ...estate,
      status: EstateStatus.DRAFT,
    });

    await expect(
      controller.archiveEstate(estateId, request),
    ).resolves.toMatchObject({ status: EstateStatus.ARCHIVED });
    await expect(
      controller.restoreEstate(estateId, request),
    ).resolves.toMatchObject({ status: EstateStatus.DRAFT });
  });

  it('documents update and archive permissions on their matching routes', () => {
    const updateHandler: unknown = Object.getOwnPropertyDescriptor(
      EstateController.prototype,
      'updateEstate',
    )?.value;
    const deleteHandler: unknown = Object.getOwnPropertyDescriptor(
      EstateController.prototype,
      'deleteEstate',
    )?.value;
    if (
      typeof updateHandler !== 'function' ||
      typeof deleteHandler !== 'function'
    ) {
      throw new Error('Expected EstateController route handlers to exist.');
    }
    const updateResponses = Reflect.getMetadata(
      API_RESPONSE_METADATA,
      updateHandler,
    ) as Record<string, { description?: string }>;
    const deleteResponses = Reflect.getMetadata(
      API_RESPONSE_METADATA,
      deleteHandler,
    ) as Record<string, { description?: string }>;

    const updateDescriptions = Object.values(updateResponses).map(
      (response) => response.description,
    );
    const deleteDescriptions = Object.values(deleteResponses).map(
      (response) => response.description,
    );

    expect(updateDescriptions).toEqual(
      expect.arrayContaining([
        'Provider lifecycle or property:update permission denied.',
      ]),
    );
    expect(updateDescriptions).not.toContain(
      'Provider lifecycle or property:archive permission denied.',
    );
    expect(deleteDescriptions).toContain(
      'Provider lifecycle or property:archive permission denied.',
    );
  });
});
