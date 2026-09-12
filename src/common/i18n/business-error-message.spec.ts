import { CommonErrorCodes } from '../errors/common-error-codes';
import { CustomerAccountErrorCodes } from '../../modules/customer/errors/customer-account-error-codes';
import { localizeBusinessError } from './business-error-message';
import { resolveApiLanguage } from './language';

describe('business error localization', () => {
  it('resolves the Vietnamese message using the business error code', () => {
    expect(
      localizeBusinessError(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND,
        ['customer-id'],
        'vi',
      ),
    ).toBe('Không tìm thấy tài khoản người dùng với mã customer-id.');
  });

  it('accepts regional language values and falls back to English', () => {
    expect(resolveApiLanguage('vi-VN')).toBe('vi');
    expect(resolveApiLanguage('fr-FR')).toBe('en');
    expect(
      localizeBusinessError(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
        ['customer@nexus.test'],
        'en',
      ),
    ).toBe('The email customer@nexus.test is already used by another user.');
  });

  it('keeps every common business error definition bilingual', () => {
    for (const errorCode of Object.values(CommonErrorCodes)) {
      expect(errorCode.messages.en).toEqual(expect.any(String));
      expect(errorCode.messages.vi).toEqual(expect.any(String));
    }
  });
});
