import {
  ErrorCodes,
  type ErrorCode,
} from '../../../../utils/constants/error.constant';

/** Stable error-code mapping used by seller-account application services. */
export const SellerAccountErrorCodes = {
  SELLER_ACCOUNT_ALREADY_EXISTS: ErrorCodes.SELLER_ACCOUNT_ALREADY_EXISTS,
  SELLER_ACCOUNT_NOT_FOUND: ErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
  SELLER_ACCOUNT_SUSPENDED: ErrorCodes.SELLER_ACCOUNT_SUSPENDED,
  SELLER_ACCOUNT_INVALID_TYPE: ErrorCodes.SELLER_ACCOUNT_INVALID_TYPE,
  SELLER_ACCOUNT_INVALID_DISPLAY_NAME:
    ErrorCodes.SELLER_ACCOUNT_INVALID_DISPLAY_NAME,
  SELLER_ACCOUNT_FORBIDDEN: ErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
  SELLER_ACCOUNT_NOT_PENDING: ErrorCodes.SELLER_ACCOUNT_NOT_PENDING,
} as const satisfies Record<string, ErrorCode>;
