import { CustomerAccountErrorCodes } from '../../modules/customer/errors/customer-account-error-codes';
import { BusinessException } from './business.exception';

describe('BusinessException', () => {
  it('maps an error code to the HTTP response shape', () => {
    const exception = new BusinessException(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
      'customer@nexus.test',
    );

    expect(exception.getStatus()).toBe(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.httpStatus,
    );
    expect(exception.errorCode).toBe(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.code,
    );
    expect(exception.messageArgs).toEqual(['customer@nexus.test']);
    expect(exception.getResponse()).toEqual({
      statusCode:
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.httpStatus,
      code: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.code,
      message: 'The email customer@nexus.test is already used by another user.',
    });
  });
});
