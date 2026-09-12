import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './messages.json';

const buyerAccountMessages = messages;

/** Business errors owned by the buyer-account bounded context. */
export const BuyerAccountErrorCodes = {
  BUYER_ACCOUNT_NOT_FOUND: defineBusinessErrorCode(
    'BUYER_ACCOUNT_NOT_FOUND',
    {
      en: buyerAccountMessages.en.BUYER_ACCOUNT_NOT_FOUND,
      vi: buyerAccountMessages.vi.BUYER_ACCOUNT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  BUYER_ACCOUNT_EMAIL_EXISTS: defineBusinessErrorCode(
    'BUYER_ACCOUNT_EMAIL_EXISTS',
    {
      en: buyerAccountMessages.en.BUYER_ACCOUNT_EMAIL_EXISTS,
      vi: buyerAccountMessages.vi.BUYER_ACCOUNT_EMAIL_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  BUYER_ACCOUNT_USERNAME_EXISTS: defineBusinessErrorCode(
    'BUYER_ACCOUNT_USERNAME_EXISTS',
    {
      en: buyerAccountMessages.en.BUYER_ACCOUNT_USERNAME_EXISTS,
      vi: buyerAccountMessages.vi.BUYER_ACCOUNT_USERNAME_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  BUYER_ACCOUNT_NOT_FOUND_BY_EMAIL: defineBusinessErrorCode(
    'BUYER_ACCOUNT_NOT_FOUND_BY_EMAIL',
    {
      en: buyerAccountMessages.en.BUYER_ACCOUNT_NOT_FOUND_BY_EMAIL,
      vi: buyerAccountMessages.vi.BUYER_ACCOUNT_NOT_FOUND_BY_EMAIL,
    },
    HttpCodes.NOT_FOUND,
  ),
  BUYER_PASSWORD_INCORRECT: defineBusinessErrorCode(
    'BUYER_PASSWORD_INCORRECT',
    {
      en: buyerAccountMessages.en.PASSWORD_INCORRECT,
      vi: buyerAccountMessages.vi.PASSWORD_INCORRECT,
    },
    HttpCodes.BAD_REQUEST,
  ),
  BUYER_PASSWORD_WEAK: defineBusinessErrorCode(
    'BUYER_PASSWORD_WEAK',
    {
      en: buyerAccountMessages.en.PASSWORD_WEAK,
      vi: buyerAccountMessages.vi.PASSWORD_WEAK,
    },
    HttpCodes.BAD_REQUEST,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
