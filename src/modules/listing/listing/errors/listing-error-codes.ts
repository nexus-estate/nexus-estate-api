import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './listing-messages.json';

/** Stable lifecycle errors owned by the listing feature. */
export const ListingErrorCodes = {
  LISTING_INVALID_STATUS_TRANSITION: defineBusinessErrorCode(
    'LISTING_INVALID_STATUS_TRANSITION',
    {
      en: messages.en.LISTING_INVALID_STATUS_TRANSITION,
      vi: messages.vi.LISTING_INVALID_STATUS_TRANSITION,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
