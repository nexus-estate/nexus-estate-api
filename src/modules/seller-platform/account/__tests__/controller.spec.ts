import type { AuthenticatedPrincipal } from '../../../auth/types/auth.type';
import { CreateSellerAccountDto, UpdateSellerAccountDto } from '../dto';
import { SellerAccountResponse } from '../dto/account.response';
import { SellerAccountController } from '../controllers/account.controller';
import { SellerAccountService } from '../services/account.service';
import { SellerType } from '../enums/account.enums';

type ServiceMock = {
  create: jest.MockedFunction<SellerAccountService['create']>;
  getCurrent: jest.MockedFunction<SellerAccountService['getCurrent']>;
  updateCurrent: jest.MockedFunction<SellerAccountService['updateCurrent']>;
};

describe('SellerAccountController', () => {
  let controller: SellerAccountController;
  let service: ServiceMock;
  const user: AuthenticatedPrincipal = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'seller@nexus.test',
    roleId: '50000000-0000-4000-8000-000000000001',
    role: 'buyer',
  };
  const account = {
    id: '20000000-0000-4000-8000-000000000001',
  } as SellerAccountResponse;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      getCurrent: jest.fn(),
      updateCurrent: jest.fn(),
    };
    controller = new SellerAccountController(
      service as unknown as SellerAccountService,
    );
  });

  it('creates for the authenticated user only', async () => {
    const dto: CreateSellerAccountDto = {
      type: SellerType.INDIVIDUAL,
      displayName: 'Seller',
    };
    service.create.mockResolvedValue(account);

    await expect(controller.create(user, dto)).resolves.toBe(account);
    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('gets the current seller', async () => {
    service.getCurrent.mockResolvedValue(account);

    await expect(controller.getCurrent(user)).resolves.toBe(account);
    expect(service.getCurrent).toHaveBeenCalledWith(user.id);
  });

  it('updates the current seller profile', async () => {
    const dto: UpdateSellerAccountDto = { displayName: 'Updated' };
    service.updateCurrent.mockResolvedValue(account);

    await expect(controller.updateCurrent(user, dto)).resolves.toBe(account);
    expect(service.updateCurrent).toHaveBeenCalledWith(user.id, dto);
  });
});
