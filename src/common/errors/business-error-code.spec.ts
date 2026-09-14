import * as sourceModule from './business-error-code';
import { CommonErrorCodes } from './common-error-codes';
import { AdministrationErrorCodes } from '../../modules/administration/authentication/errors/administration-error-codes';
import { AuthorizationErrorCodes } from '../../modules/administration/authorization/errors/authorization-error-codes';
import { CustomerAccountErrorCodes } from '../../modules/customer/account/errors/customer-account-error-codes';
import { CustomerAuthErrorCodes } from '../../modules/customer/authentication/errors/customer-auth-error-codes';
import { ProviderAccountErrorCodes } from '../../modules/provider/account/errors/provider-account-error-codes';
import { RbacErrorCodes } from '../../modules/rbac/legacy-global/errors/rbac-error-codes';

describe('business error code', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });

  it('requires an explicit English and Vietnamese message pair', () => {
    const errorCode = sourceModule.defineBusinessErrorCode(
      'EXAMPLE_ERROR',
      { en: 'Example error.', vi: 'Lỗi ví dụ.' },
      400,
    );

    expect(errorCode.messages).toEqual({
      en: 'Example error.',
      vi: 'Lỗi ví dụ.',
    });
  });

  it('keeps every module-owned error catalogue bilingual', () => {
    const catalogues = [
      CommonErrorCodes,
      AdministrationErrorCodes,
      AuthorizationErrorCodes,
      CustomerAccountErrorCodes,
      CustomerAuthErrorCodes,
      ProviderAccountErrorCodes,
      RbacErrorCodes,
    ];

    for (const catalogue of catalogues) {
      for (const errorCode of Object.values(catalogue)) {
        expect(errorCode.messages.en).toEqual(expect.any(String));
        expect(errorCode.messages.vi).toEqual(expect.any(String));
        expect(errorCode.messages.en.length).toBeGreaterThan(0);
        expect(errorCode.messages.vi.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every localized message actionable for the user', () => {
    const catalogues = [
      CommonErrorCodes,
      AdministrationErrorCodes,
      AuthorizationErrorCodes,
      CustomerAccountErrorCodes,
      CustomerAuthErrorCodes,
      ProviderAccountErrorCodes,
      RbacErrorCodes,
    ];
    const englishAction =
      /please|check|verify|try|use|choose|contact|wait|sign in|provide|select|refresh|remove|keep|update|enter|assign|review|reset/i;
    const vietnameseAction =
      /vui lòng|hãy|kiểm tra|thử|sử dụng|chọn|liên hệ|chờ|đăng nhập|nhập|làm mới|gỡ|xóa|giữ|cập nhật|gán|đặt lại/i;

    for (const catalogue of catalogues) {
      for (const errorCode of Object.values(catalogue)) {
        expect(errorCode.messages.en).toMatch(englishAction);
        expect(errorCode.messages.vi).toMatch(vietnameseAction);
      }
    }
  });
});
