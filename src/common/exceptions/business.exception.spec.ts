import { ErrorCodes } from '../../utils/constants/error.constant';
import { BusinessException } from './business.exception';

describe('BusinessException', () => {
  it('maps an error code to the HTTP response shape', () => {
    const exception = new BusinessException(
      ErrorCodes.USER_EMAIL_EXISTS,
      'buyer@nexus.test',
    );

    expect(exception.getStatus()).toBe(ErrorCodes.USER_EMAIL_EXISTS.httpStatus);
    expect(exception.errorCode).toBe(ErrorCodes.USER_EMAIL_EXISTS.code);
    expect(exception.getResponse()).toEqual({
      statusCode: ErrorCodes.USER_EMAIL_EXISTS.httpStatus,
      code: ErrorCodes.USER_EMAIL_EXISTS.code,
      message: 'A user with email buyer@nexus.test already exists.',
    });
  });
});
