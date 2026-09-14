import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './customer-account-messages.json';

const customerAccountMessages = messages;

/** Business errors owned by the customer-account bounded context. */
export const CustomerAccountErrorCodes = {
  CUSTOMER_ACCOUNT_NOT_FOUND: defineBusinessErrorCode(
    'CUSTOMER_ACCOUNT_NOT_FOUND',
    {
      en: customerAccountMessages.en.CUSTOMER_ACCOUNT_NOT_FOUND,
      vi: customerAccountMessages.vi.CUSTOMER_ACCOUNT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  CUSTOMER_ACCOUNT_EMAIL_EXISTS: defineBusinessErrorCode(
    'CUSTOMER_ACCOUNT_EMAIL_EXISTS',
    {
      en: customerAccountMessages.en.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
      vi: customerAccountMessages.vi.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  CUSTOMER_ACCOUNT_USERNAME_EXISTS: defineBusinessErrorCode(
    'CUSTOMER_ACCOUNT_USERNAME_EXISTS',
    {
      en: customerAccountMessages.en.CUSTOMER_ACCOUNT_USERNAME_EXISTS,
      vi: customerAccountMessages.vi.CUSTOMER_ACCOUNT_USERNAME_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  CUSTOMER_ACCOUNT_NOT_FOUND_BY_EMAIL: defineBusinessErrorCode(
    'CUSTOMER_ACCOUNT_NOT_FOUND_BY_EMAIL',
    {
      en: customerAccountMessages.en.CUSTOMER_ACCOUNT_NOT_FOUND_BY_EMAIL,
      vi: customerAccountMessages.vi.CUSTOMER_ACCOUNT_NOT_FOUND_BY_EMAIL,
    },
    HttpCodes.NOT_FOUND,
  ),
  CUSTOMER_PASSWORD_INCORRECT: defineBusinessErrorCode(
    'CUSTOMER_PASSWORD_INCORRECT',
    {
      en: customerAccountMessages.en.PASSWORD_INCORRECT,
      vi: customerAccountMessages.vi.PASSWORD_INCORRECT,
    },
    HttpCodes.BAD_REQUEST,
  ),
  CUSTOMER_PASSWORD_WEAK: defineBusinessErrorCode(
    'CUSTOMER_PASSWORD_WEAK',
    {
      en: customerAccountMessages.en.PASSWORD_WEAK,
      vi: customerAccountMessages.vi.PASSWORD_WEAK,
    },
    HttpCodes.BAD_REQUEST,
  ),
} as const satisfies Record<string, BusinessErrorCode>;

/** @deprecated Use CustomerAccountErrorCodes in new code. */
