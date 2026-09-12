import { SellerAccountErrorCodes } from '../errors/seller-account-error-codes';
import { CreateSellerAccountDto, UpdateSellerAccountDto } from '../dto';
import { SellerAccount } from '../models/account.entity';
import { CurrentSellerContext } from '../services/current-seller-context.service';
import { SellerAccountPolicy } from '../helpers/account.policy';
import { SellerAccountRepository } from '../repositories/account.repository';
import { SellerAccountService } from '../services/account.service';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

type RepositoryMock = {
  findById: jest.MockedFunction<SellerAccountRepository['findById']>;
  findByOwnerBuyerId: jest.MockedFunction<
    SellerAccountRepository['findByOwnerBuyerId']
  >;
  existsByOwnerBuyerId: jest.MockedFunction<
    SellerAccountRepository['existsByOwnerBuyerId']
  >;
  create: jest.MockedFunction<SellerAccountRepository['create']>;
  update: jest.MockedFunction<SellerAccountRepository['update']>;
};

describe('SellerAccountService', () => {
  let service: SellerAccountService;
  let repository: RepositoryMock;
  let currentSellerContext: CurrentSellerContext;
  let policy: SellerAccountPolicy;

  const buyerId = '10000000-0000-4000-8000-000000000001';
  const sellerId = '20000000-0000-4000-8000-000000000001';
  const account = {
    id: sellerId,
    ownerBuyerId: buyerId,
    type: SellerType.INDIVIDUAL,
    displayName: 'Nguyen Van A',
    status: SellerStatus.ACTIVE,
    verificationStatus: SellerVerificationStatus.UNVERIFIED,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  } as SellerAccount;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByOwnerBuyerId: jest.fn(),
      existsByOwnerBuyerId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    currentSellerContext = new CurrentSellerContext(
      repository as unknown as SellerAccountRepository,
    );
    policy = new SellerAccountPolicy();
    service = new SellerAccountService(
      repository as unknown as SellerAccountRepository,
      currentSellerContext,
      policy,
    );
  });

  it('creates an account with server-controlled defaults', async () => {
    repository.existsByOwnerBuyerId.mockResolvedValue(false);
    repository.create.mockResolvedValue(account);

    const dto: CreateSellerAccountDto = {
      type: SellerType.INDIVIDUAL,
      displayName: '  Nguyen Van A  ',
    };

    await expect(service.createForBuyer(buyerId, dto)).resolves.toMatchObject({
      id: sellerId,
      type: SellerType.INDIVIDUAL,
      displayName: 'Nguyen Van A',
      status: SellerStatus.ACTIVE,
      verificationStatus: SellerVerificationStatus.UNVERIFIED,
    });
    expect(repository.create).toHaveBeenCalledWith({
      ownerBuyerId: buyerId,
      type: SellerType.INDIVIDUAL,
      displayName: 'Nguyen Van A',
      status: SellerStatus.ACTIVE,
      verificationStatus: SellerVerificationStatus.UNVERIFIED,
    });
  });

  it('rejects duplicate accounts before persistence', async () => {
    repository.existsByOwnerBuyerId.mockResolvedValue(true);

    await expect(
      service.createForBuyer(buyerId, {
        type: SellerType.BROKER,
        displayName: 'Broker',
      }),
    ).rejects.toMatchObject({
      errorCode: SellerAccountErrorCodes.SELLER_ACCOUNT_ALREADY_EXISTS.code,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['', SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_DISPLAY_NAME.code],
    ['   ', SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_DISPLAY_NAME.code],
  ])('rejects a blank display name', async (displayName, errorCode) => {
    await expect(
      service.createForBuyer(buyerId, {
        type: SellerType.INDIVIDUAL,
        displayName,
      }),
    ).rejects.toMatchObject({ errorCode });
  });

  it('rejects an invalid seller type', async () => {
    await expect(
      service.createForBuyer(buyerId, {
        type: 'NOT_A_SELLER_TYPE' as SellerType,
        displayName: 'Seller',
      }),
    ).rejects.toMatchObject({
      errorCode: SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_TYPE.code,
    });
  });

  it('gets the current account without auto-creating it', async () => {
    repository.findByOwnerBuyerId.mockResolvedValue(account);
    repository.findById.mockResolvedValue(account);

    await expect(service.getCurrent(buyerId)).resolves.toMatchObject({
      id: sellerId,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns not found when the current account is missing', async () => {
    repository.findByOwnerBuyerId.mockResolvedValue(null);

    await expect(service.getCurrent(buyerId)).rejects.toMatchObject({
      errorCode: SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND.code,
    });
  });

  it('updates only the display name', async () => {
    repository.findByOwnerBuyerId.mockResolvedValue(account);
    repository.findById.mockResolvedValue(account);
    repository.update.mockResolvedValue({
      ...account,
      displayName: 'Updated Name',
    });

    const dto: UpdateSellerAccountDto = { displayName: ' Updated Name ' };
    await expect(service.updateCurrent(buyerId, dto)).resolves.toMatchObject({
      displayName: 'Updated Name',
      status: SellerStatus.ACTIVE,
      verificationStatus: SellerVerificationStatus.UNVERIFIED,
    });
    expect(repository.update).toHaveBeenCalledWith(sellerId, {
      displayName: 'Updated Name',
    });
  });

  it('resolves a reusable current seller context', async () => {
    repository.findByOwnerBuyerId.mockResolvedValue(account);

    await expect(service.resolveCurrentSeller(buyerId)).resolves.toEqual({
      buyerId,
      sellerId,
      sellerType: SellerType.INDIVIDUAL,
      sellerStatus: SellerStatus.ACTIVE,
      verificationStatus: SellerVerificationStatus.UNVERIFIED,
    });
  });
});
