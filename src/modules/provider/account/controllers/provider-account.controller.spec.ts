import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import {
  CreateProviderAccountDto,
  UpdateProviderAccountDto,
} from '../dto/index';
import { ProviderAccountResponse } from '../dto/provider-account.response';
import { ProviderAccountController } from './provider-account.controller';
import { ProviderAccountService } from '../services/provider-account.service';
import { ProviderAccountCommandService } from '../services/provider-account-command.service';
import { ProviderType } from '../enums/account.enums';

type ServiceMock = {
  getCurrent: jest.MockedFunction<ProviderAccountService['getCurrent']>;
  updateCurrent: jest.MockedFunction<ProviderAccountService['updateCurrent']>;
};

type CommandServiceMock = {
  createPending: jest.MockedFunction<
    ProviderAccountCommandService['createPending']
  >;
};

describe('ProviderAccountController', () => {
  let controller: ProviderAccountController;
  let service: ServiceMock;
  let commandService: CommandServiceMock;
  const user: CustomerPrincipal = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'provider@nexus.test',
    realm: 'customer',
  };
  const providerId = '20000000-0000-4000-8000-000000000001';
  const account = { id: providerId } as ProviderAccountResponse;

  beforeEach(() => {
    service = {
      getCurrent: jest.fn(),
      updateCurrent: jest.fn(),
    };
    commandService = { createPending: jest.fn() };
    controller = new ProviderAccountController(
      service as unknown as ProviderAccountService,
      commandService as unknown as ProviderAccountCommandService,
    );
  });

  it('creates through the command service and reloads the canonical account', async () => {
    const dto: CreateProviderAccountDto = {
      type: ProviderType.INDIVIDUAL,
      displayName: 'Provider',
    };
    commandService.createPending.mockResolvedValue(providerId);
    service.getCurrent.mockResolvedValue(account);

    await expect(controller.create(user, dto)).resolves.toBe(account);
    expect(commandService.createPending).toHaveBeenCalledWith(user.id, dto);
    expect(service.getCurrent).toHaveBeenCalledWith(user.id, providerId);
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
