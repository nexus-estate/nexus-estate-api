import { AuthorizationErrorCodes } from './authorization-error-codes';

describe('AuthorizationErrorCodes', () => {
  it('exposes stable API error identifiers and useful HTTP statuses', () => {
    expect(AuthorizationErrorCodes.ROLE_NOT_FOUND.code).toBe(
      'AUTHORIZATION_ROLE_NOT_FOUND',
    );
    expect(AuthorizationErrorCodes.ROLE_NOT_FOUND.httpStatus).toBe(404);
    expect(AuthorizationErrorCodes.ROLE_VERSION_CONFLICT.httpStatus).toBe(409);
    expect(AuthorizationErrorCodes.LAST_ADMIN_PROTECTION.httpStatus).toBe(409);
  });

  it('covers all required management invariant failures', () => {
    expect(Object.keys(AuthorizationErrorCodes)).toEqual(
      expect.arrayContaining([
        'PLATFORM_NOT_FOUND',
        'ROLE_CODE_EXISTS',
        'ROLE_IN_USE',
        'SYSTEM_ROLE_IMMUTABLE',
        'PERMISSION_NOT_ASSIGNABLE',
        'PERMISSION_PLATFORM_MISMATCH',
        'ROLE_PLATFORM_MISMATCH',
        'PROVIDER_LAST_OWNER_PROTECTION',
      ]),
    );
  });

  it('provides an explicit English and Vietnamese message for every error', () => {
    for (const errorCode of Object.values(AuthorizationErrorCodes)) {
      expect(errorCode.messages.en).toEqual(expect.any(String));
      expect(errorCode.messages.vi).toEqual(expect.any(String));
      expect(errorCode.messages.en.length).toBeGreaterThan(0);
      expect(errorCode.messages.vi.length).toBeGreaterThan(0);
    }
  });
});
