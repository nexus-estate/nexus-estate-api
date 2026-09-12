import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../common/errors/business-error-code';
import { HttpCodes } from '../../../common/errors/http-codes';
import messages from './customer-auth-messages.json';

const customerAuthMessages = messages;

/** Authentication errors owned by the customer authentication boundary. */
export const CustomerAuthErrorCodes = {
  INVALID_CREDENTIALS: defineBusinessErrorCode(
    'CUSTOMER_INVALID_CREDENTIALS',
    {
      en: customerAuthMessages.en.INVALID_CREDENTIALS,
      vi: customerAuthMessages.vi.INVALID_CREDENTIALS,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_EXPIRED: defineBusinessErrorCode(
    'CUSTOMER_TOKEN_EXPIRED',
    {
      en: customerAuthMessages.en.TOKEN_EXPIRED,
      vi: customerAuthMessages.vi.TOKEN_EXPIRED,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_INVALID: defineBusinessErrorCode(
    'CUSTOMER_TOKEN_INVALID',
    {
      en: customerAuthMessages.en.TOKEN_INVALID,
      vi: customerAuthMessages.vi.TOKEN_INVALID,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_NOT_PROVIDED: defineBusinessErrorCode(
    'CUSTOMER_TOKEN_NOT_PROVIDED',
    {
      en: customerAuthMessages.en.TOKEN_NOT_PROVIDED,
      vi: customerAuthMessages.vi.TOKEN_NOT_PROVIDED,
    },
    HttpCodes.UNAUTHORIZED,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
