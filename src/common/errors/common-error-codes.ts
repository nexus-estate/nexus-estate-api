import messages from './messages.json';
import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from './business-error-code';
import { HttpCodes } from './http-codes';

const commonMessages = messages;

/** Error definitions shared by HTTP infrastructure and cross-module concerns. */
export const CommonErrorCodes = {
  AUTHENTICATION_REQUIRED: defineBusinessErrorCode(
    'AUTHENTICATION_REQUIRED',
    {
      en: commonMessages.en.AUTHENTICATION_REQUIRED,
      vi: commonMessages.vi.AUTHENTICATION_REQUIRED,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  FORBIDDEN: defineBusinessErrorCode(
    'FORBIDDEN',
    { en: commonMessages.en.FORBIDDEN, vi: commonMessages.vi.FORBIDDEN },
    HttpCodes.FORBIDDEN,
  ),
  VALIDATION_ERROR: defineBusinessErrorCode(
    'VALIDATION_ERROR',
    {
      en: commonMessages.en.VALIDATION_ERROR,
      vi: commonMessages.vi.VALIDATION_ERROR,
    },
    HttpCodes.BAD_REQUEST,
  ),
  INVALID_UUID: defineBusinessErrorCode(
    'INVALID_UUID',
    { en: commonMessages.en.INVALID_UUID, vi: commonMessages.vi.INVALID_UUID },
    HttpCodes.BAD_REQUEST,
  ),
  INVALID_PAGINATION: defineBusinessErrorCode(
    'INVALID_PAGINATION',
    {
      en: commonMessages.en.INVALID_PAGINATION,
      vi: commonMessages.vi.INVALID_PAGINATION,
    },
    HttpCodes.BAD_REQUEST,
  ),
  RESOURCE_NOT_FOUND: defineBusinessErrorCode(
    'RESOURCE_NOT_FOUND',
    {
      en: commonMessages.en.RESOURCE_NOT_FOUND,
      vi: commonMessages.vi.RESOURCE_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  RESOURCE_CONFLICT: defineBusinessErrorCode(
    'RESOURCE_CONFLICT',
    {
      en: commonMessages.en.RESOURCE_CONFLICT,
      vi: commonMessages.vi.RESOURCE_CONFLICT,
    },
    HttpCodes.CONFLICT,
  ),
  INTERNAL_ERROR: defineBusinessErrorCode(
    'INTERNAL_ERROR',
    {
      en: commonMessages.en.INTERNAL_ERROR,
      vi: commonMessages.vi.INTERNAL_ERROR,
    },
    HttpCodes.INTERNAL_SERVER_ERROR,
  ),
  DATABASE_ERROR: defineBusinessErrorCode(
    'DATABASE_ERROR',
    {
      en: commonMessages.en.DATABASE_ERROR,
      vi: commonMessages.vi.DATABASE_ERROR,
    },
    HttpCodes.INTERNAL_SERVER_ERROR,
  ),
  RATE_LIMIT_EXCEEDED: defineBusinessErrorCode(
    'RATE_LIMIT_EXCEEDED',
    {
      en: commonMessages.en.RATE_LIMIT_EXCEEDED,
      vi: commonMessages.vi.RATE_LIMIT_EXCEEDED,
    },
    HttpCodes.TOO_MANY_REQUESTS,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
