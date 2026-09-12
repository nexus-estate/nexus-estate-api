import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './messages.json';

const buyerAuthMessages = messages;

/** Authentication errors owned by the buyer authentication boundary. */
export const BuyerAuthErrorCodes = {
  INVALID_CREDENTIALS: defineBusinessErrorCode(
    'BUYER_INVALID_CREDENTIALS',
    {
      en: buyerAuthMessages.en.INVALID_CREDENTIALS,
      vi: buyerAuthMessages.vi.INVALID_CREDENTIALS,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_EXPIRED: defineBusinessErrorCode(
    'BUYER_TOKEN_EXPIRED',
    {
      en: buyerAuthMessages.en.TOKEN_EXPIRED,
      vi: buyerAuthMessages.vi.TOKEN_EXPIRED,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_INVALID: defineBusinessErrorCode(
    'BUYER_TOKEN_INVALID',
    {
      en: buyerAuthMessages.en.TOKEN_INVALID,
      vi: buyerAuthMessages.vi.TOKEN_INVALID,
    },
    HttpCodes.UNAUTHORIZED,
  ),
  TOKEN_NOT_PROVIDED: defineBusinessErrorCode(
    'BUYER_TOKEN_NOT_PROVIDED',
    {
      en: buyerAuthMessages.en.TOKEN_NOT_PROVIDED,
      vi: buyerAuthMessages.vi.TOKEN_NOT_PROVIDED,
    },
    HttpCodes.UNAUTHORIZED,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
