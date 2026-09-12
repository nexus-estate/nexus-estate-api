import { BuyerAccountErrorCodes } from '../../modules/buyer/account/errors/buyer-account-error-codes';
import { BusinessException } from './business.exception';

describe('BusinessException', () => {
  it('maps an error code to the HTTP response shape', () => {
    const exception = new BusinessException(
      BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS,
      'buyer@nexus.test',
    );

    expect(exception.getStatus()).toBe(
      BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.httpStatus,
    );
    expect(exception.errorCode).toBe(
      BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.code,
    );
    expect(exception.messageArgs).toEqual(['buyer@nexus.test']);
    expect(exception.getResponse()).toEqual({
      statusCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.httpStatus,
      code: BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.code,
      message:
        'The email buyer@nexus.test is already used by another buyer account.',
    });
  });
});
