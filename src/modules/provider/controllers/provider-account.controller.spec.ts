import type { AuthenticatedPrincipal } from '../../../common/security/auth.types';
import { CreateProviderAccountDto, UpdateProviderAccountDto } from '../dto';
import { ProviderAccountResponse as ProviderAccountResponse } from '../dto/provider-account.response';
import { ProviderAccountController as ProviderAccountController } from '../controllers/provider-account.controller';
import { ProviderAccountService as ProviderAccountService } from '../services/provider-account.service';
import { ProviderType } from '../enums/account.enums';

type ServiceMock = {
  createForCustomer: jest.MockedFunction<
    ProviderAccountService['createForCustomer']
  >;
  getCurrent: jest.MockedFunction<ProviderAccountService['getCurrent']>;
  updateCurrent: jest.MockedFunction<ProviderAccountService['updateCurrent']>;
};

describe('ProviderAccountController', () => {
  let controller: ProviderAccountController;
  let service: ServiceMock;
  const user: AuthenticatedPrincipal = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'provider@nexus.test',
    roleId: '50000000-0000-4000-8000-000000000001',
    role: 'customer',
  };
  const account = {
    id: '20000000-0000-4000-8000-000000000001',
  } as ProviderAccountResponse;

  beforeEach(() => {
    service = {
      createForCustomer: jest.fn(),
      getCurrent: jest.fn(),
      updateCurrent: jest.fn(),
    };
    controller = new ProviderAccountController(
      service as unknown as ProviderAccountService,
    );
  });

  it('creates for the authenticated user only', async () => {
    const dto: CreateProviderAccountDto = {
      type: ProviderType.INDIVIDUAL,
      displayName: 'Provider',
    };
    service.createForCustomer.mockResolvedValue(account);

    await expect(controller.create(user, dto)).resolves.toBe(account);
    expect(service.createForCustomer).toHaveBeenCalledWith(user.id, dto);
  });

  it('gets the current provider', async () => {
    service.getCurrent.mockResolvedValue(account);

    await expect(controller.getCurrent(user)).resolves.toBe(account);
    expect(service.getCurrent).toHaveBeenCalledWith(user.id);
  });

  it('updates the current provider profile', async () => {
    const dto: UpdateProviderAccountDto = { displayName: 'Updated' };
    service.updateCurrent.mockResolvedValue(account);

    await expect(controller.updateCurrent(user, dto)).resolves.toBe(account);
    expect(service.updateCurrent).toHaveBeenCalledWith(user.id, dto);
  });
});
