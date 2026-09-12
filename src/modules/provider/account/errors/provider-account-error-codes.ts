import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './provider-account-messages.json';

const providerAccountMessages = messages;

/** Business errors owned by the provider-account bounded context. */
export const ProviderAccountErrorCodes = {
  PROVIDER_ACCOUNT_ALREADY_EXISTS: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_ALREADY_EXISTS',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_ALREADY_EXISTS,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_ALREADY_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  PROVIDER_ACCOUNT_NOT_FOUND: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_NOT_FOUND',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_NOT_FOUND,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  PROVIDER_ACCOUNT_SUSPENDED: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_SUSPENDED',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_SUSPENDED,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_SUSPENDED,
    },
    HttpCodes.FORBIDDEN,
  ),
  PROVIDER_ACCOUNT_NOT_VERIFIED: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_NOT_VERIFIED',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_NOT_VERIFIED,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_NOT_VERIFIED,
    },
    HttpCodes.FORBIDDEN,
  ),
  PROVIDER_ACCOUNT_INVALID_TYPE: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_INVALID_TYPE',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_INVALID_TYPE,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_INVALID_TYPE,
    },
    HttpCodes.BAD_REQUEST,
  ),
  PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME,
    },
    HttpCodes.BAD_REQUEST,
  ),
  PROVIDER_ACCOUNT_FORBIDDEN: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_FORBIDDEN',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_FORBIDDEN,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_FORBIDDEN,
    },
    HttpCodes.FORBIDDEN,
  ),
  PROVIDER_ACCOUNT_NOT_PENDING: defineBusinessErrorCode(
    'PROVIDER_ACCOUNT_NOT_PENDING',
    {
      en: providerAccountMessages.en.PROVIDER_ACCOUNT_NOT_PENDING,
      vi: providerAccountMessages.vi.PROVIDER_ACCOUNT_NOT_PENDING,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
