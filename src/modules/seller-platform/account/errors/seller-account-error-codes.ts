import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './messages.json';

const sellerAccountMessages = messages;

/** Business errors owned by the seller-account bounded context. */
export const SellerAccountErrorCodes = {
  SELLER_ACCOUNT_ALREADY_EXISTS: defineBusinessErrorCode(
    'SELLER_ACCOUNT_ALREADY_EXISTS',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_ALREADY_EXISTS,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_ALREADY_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  SELLER_ACCOUNT_NOT_FOUND: defineBusinessErrorCode(
    'SELLER_ACCOUNT_NOT_FOUND',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_NOT_FOUND,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  SELLER_ACCOUNT_SUSPENDED: defineBusinessErrorCode(
    'SELLER_ACCOUNT_SUSPENDED',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_SUSPENDED,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_SUSPENDED,
    },
    HttpCodes.FORBIDDEN,
  ),
  SELLER_ACCOUNT_INVALID_TYPE: defineBusinessErrorCode(
    'SELLER_ACCOUNT_INVALID_TYPE',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_INVALID_TYPE,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_INVALID_TYPE,
    },
    HttpCodes.BAD_REQUEST,
  ),
  SELLER_ACCOUNT_INVALID_DISPLAY_NAME: defineBusinessErrorCode(
    'SELLER_ACCOUNT_INVALID_DISPLAY_NAME',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_INVALID_DISPLAY_NAME,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_INVALID_DISPLAY_NAME,
    },
    HttpCodes.BAD_REQUEST,
  ),
  SELLER_ACCOUNT_FORBIDDEN: defineBusinessErrorCode(
    'SELLER_ACCOUNT_FORBIDDEN',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_FORBIDDEN,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_FORBIDDEN,
    },
    HttpCodes.FORBIDDEN,
  ),
  SELLER_ACCOUNT_NOT_PENDING: defineBusinessErrorCode(
    'SELLER_ACCOUNT_NOT_PENDING',
    {
      en: sellerAccountMessages.en.SELLER_ACCOUNT_NOT_PENDING,
      vi: sellerAccountMessages.vi.SELLER_ACCOUNT_NOT_PENDING,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
