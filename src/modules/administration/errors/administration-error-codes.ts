import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../common/errors/business-error-code';
import { HttpCodes } from '../../../common/errors/http-codes';
import messages from './messages.json';

const administrationMessages = messages;

/** Business errors owned by the internal administration boundary. */
export const AdministrationErrorCodes = {
  INVALID_CREDENTIALS: defineBusinessErrorCode(
    'ADMIN_INVALID_CREDENTIALS',
    {
      en: administrationMessages.en.ADMIN_INVALID_CREDENTIALS,
      vi: administrationMessages.vi.ADMIN_INVALID_CREDENTIALS,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  ACCOUNT_NOT_FOUND: defineBusinessErrorCode(
    'ADMIN_ACCOUNT_NOT_FOUND',
    {
      en: administrationMessages.en.ADMIN_ACCOUNT_NOT_FOUND,
      vi: administrationMessages.vi.ADMIN_ACCOUNT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  ACCOUNT_INACTIVE: defineBusinessErrorCode(
    'ADMIN_ACCOUNT_INACTIVE',
    {
      en: administrationMessages.en.ADMIN_ACCOUNT_INACTIVE,
      vi: administrationMessages.vi.ADMIN_ACCOUNT_INACTIVE,
    },
    HttpCodes.FORBIDDEN,
  ),
  TOKEN_INVALID: defineBusinessErrorCode(
    'ADMIN_TOKEN_INVALID',
    {
      en: administrationMessages.en.ADMIN_TOKEN_INVALID,
      vi: administrationMessages.vi.ADMIN_TOKEN_INVALID,
    },
    HttpCodes.UNAUTHORIZED,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
