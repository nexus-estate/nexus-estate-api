import { CommonErrorCodes } from '../errors/common-error-codes';
import { BuyerAccountErrorCodes } from '../../modules/buyer/account/errors/buyer-account-error-codes';
import { localizeBusinessError } from './business-error-message';
import { resolveApiLanguage } from './language';

describe('business error localization', () => {
  it('resolves the Vietnamese message using the business error code', () => {
    expect(
      localizeBusinessError(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND,
        ['buyer-id'],
        'vi',
      ),
    ).toBe('Không tìm thấy tài khoản người mua với mã buyer-id.');
  });

  it('accepts regional language values and falls back to English', () => {
    expect(resolveApiLanguage('vi-VN')).toBe('vi');
    expect(resolveApiLanguage('fr-FR')).toBe('en');
    expect(
      localizeBusinessError(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS,
        ['buyer@nexus.test'],
        'en',
      ),
    ).toBe(
      'The email buyer@nexus.test is already used by another buyer account.',
    );
  });

  it('keeps every common business error definition bilingual', () => {
    for (const errorCode of Object.values(CommonErrorCodes)) {
      expect(errorCode.messages.en).toEqual(expect.any(String));
      expect(errorCode.messages.vi).toEqual(expect.any(String));
    }
  });
});
