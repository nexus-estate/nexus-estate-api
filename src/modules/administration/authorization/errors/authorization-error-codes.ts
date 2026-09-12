import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './authorization-messages.json';

const authorizationMessages = messages;

/** Stable errors for the authorization management plane. */
export const AuthorizationErrorCodes = {
  PLATFORM_NOT_FOUND: defineBusinessErrorCode(
    'AUTHORIZATION_PLATFORM_NOT_FOUND',
    {
      en: authorizationMessages.en.AUTHORIZATION_PLATFORM_NOT_FOUND,
      vi: authorizationMessages.vi.AUTHORIZATION_PLATFORM_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  ROLE_NOT_FOUND: defineBusinessErrorCode(
    'AUTHORIZATION_ROLE_NOT_FOUND',
    {
      en: authorizationMessages.en.AUTHORIZATION_ROLE_NOT_FOUND,
      vi: authorizationMessages.vi.AUTHORIZATION_ROLE_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  ROLE_CODE_EXISTS: defineBusinessErrorCode(
    'AUTHORIZATION_ROLE_CODE_EXISTS',
    {
      en: authorizationMessages.en.AUTHORIZATION_ROLE_CODE_EXISTS,
      vi: authorizationMessages.vi.AUTHORIZATION_ROLE_CODE_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  ROLE_IN_USE: defineBusinessErrorCode(
    'AUTHORIZATION_ROLE_IN_USE',
    {
      en: authorizationMessages.en.AUTHORIZATION_ROLE_IN_USE,
      vi: authorizationMessages.vi.AUTHORIZATION_ROLE_IN_USE,
    },
    HttpCodes.CONFLICT,
  ),
  SYSTEM_ROLE_IMMUTABLE: defineBusinessErrorCode(
    'AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE',
    {
      en: authorizationMessages.en.AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE,
      vi: authorizationMessages.vi.AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE,
    },
    HttpCodes.CONFLICT,
  ),
  ROLE_VERSION_CONFLICT: defineBusinessErrorCode(
    'AUTHORIZATION_ROLE_VERSION_CONFLICT',
    {
      en: authorizationMessages.en.AUTHORIZATION_ROLE_VERSION_CONFLICT,
      vi: authorizationMessages.vi.AUTHORIZATION_ROLE_VERSION_CONFLICT,
    },
    HttpCodes.CONFLICT,
  ),
  PERMISSION_NOT_FOUND: defineBusinessErrorCode(
    'AUTHORIZATION_PERMISSION_NOT_FOUND',
    {
      en: authorizationMessages.en.AUTHORIZATION_PERMISSION_NOT_FOUND,
      vi: authorizationMessages.vi.AUTHORIZATION_PERMISSION_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  PERMISSION_NOT_ASSIGNABLE: defineBusinessErrorCode(
    'AUTHORIZATION_PERMISSION_NOT_ASSIGNABLE',
    {
      en: authorizationMessages.en.AUTHORIZATION_PERMISSION_NOT_ASSIGNABLE,
      vi: authorizationMessages.vi.AUTHORIZATION_PERMISSION_NOT_ASSIGNABLE,
    },
    HttpCodes.CONFLICT,
  ),
  PERMISSION_PLATFORM_MISMATCH: defineBusinessErrorCode(
    'AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH',
    {
      en: authorizationMessages.en.AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH,
      vi: authorizationMessages.vi.AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH,
    },
    HttpCodes.CONFLICT,
  ),
  SUBJECT_NOT_FOUND: defineBusinessErrorCode(
    'AUTHORIZATION_SUBJECT_NOT_FOUND',
    {
      en: authorizationMessages.en.AUTHORIZATION_SUBJECT_NOT_FOUND,
      vi: authorizationMessages.vi.AUTHORIZATION_SUBJECT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  ROLE_PLATFORM_MISMATCH: defineBusinessErrorCode(
    'AUTHORIZATION_ROLE_PLATFORM_MISMATCH',
    {
      en: authorizationMessages.en.AUTHORIZATION_ROLE_PLATFORM_MISMATCH,
      vi: authorizationMessages.vi.AUTHORIZATION_ROLE_PLATFORM_MISMATCH,
    },
    HttpCodes.CONFLICT,
  ),
  LAST_ADMIN_PROTECTION: defineBusinessErrorCode(
    'AUTHORIZATION_LAST_ADMIN_PROTECTION',
    {
      en: authorizationMessages.en.AUTHORIZATION_LAST_ADMIN_PROTECTION,
      vi: authorizationMessages.vi.AUTHORIZATION_LAST_ADMIN_PROTECTION,
    },
    HttpCodes.CONFLICT,
  ),
  ASSIGNMENT_CONFLICT: defineBusinessErrorCode(
    'AUTHORIZATION_ASSIGNMENT_CONFLICT',
    {
      en: authorizationMessages.en.AUTHORIZATION_ASSIGNMENT_CONFLICT,
      vi: authorizationMessages.vi.AUTHORIZATION_ASSIGNMENT_CONFLICT,
    },
    HttpCodes.CONFLICT,
  ),
  PROVIDER_LAST_OWNER_PROTECTION: defineBusinessErrorCode(
    'PROVIDER_LAST_OWNER_PROTECTION',
    {
      en: authorizationMessages.en.PROVIDER_LAST_OWNER_PROTECTION,
      vi: authorizationMessages.vi.PROVIDER_LAST_OWNER_PROTECTION,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
