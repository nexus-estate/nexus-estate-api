import { ErrorCodes } from '../../../../utils/constants/error.constant';
import { SellerAccountPolicy } from '../policy';
import { SellerStatus, SellerType, SellerVerificationStatus } from '../enums';
import { CurrentSellerContextValue } from '../current-seller-context';

describe('SellerAccountPolicy', () => {
  const policy = new SellerAccountPolicy();
  const context: CurrentSellerContextValue = {
    userId: '10000000-0000-4000-8000-000000000001',
    sellerId: '20000000-0000-4000-8000-000000000001',
    sellerType: SellerType.INDIVIDUAL,
    sellerStatus: SellerStatus.ACTIVE,
    verificationStatus: SellerVerificationStatus.UNVERIFIED,
  };

  it('allows active sellers to perform supply mutations', () => {
    expect(() => policy.requireActiveSeller(context)).not.toThrow();
  });

  it('blocks suspended sellers', () => {
    let error: unknown;
    try {
      policy.requireActiveSeller({
        ...context,
        sellerStatus: SellerStatus.SUSPENDED,
      });
    } catch (candidate: unknown) {
      error = candidate;
    }
    expect(error).toMatchObject({
      errorCode: ErrorCodes.SELLER_ACCOUNT_SUSPENDED.code,
    });
  });

  it('requires the current seller to own a resource', () => {
    let error: unknown;
    try {
      policy.requireSellerOwnership(
        context,
        '20000000-0000-4000-8000-000000000002',
      );
    } catch (candidate: unknown) {
      error = candidate;
    }
    expect(error).toMatchObject({
      errorCode: ErrorCodes.SELLER_ACCOUNT_FORBIDDEN.code,
    });
  });
});
