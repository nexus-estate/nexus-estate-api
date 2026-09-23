import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './estate-messages.json';

/** Stable lifecycle and ownership errors owned by the property feature. */
export const EstateErrorCodes = {
  PROPERTY_INVALID_STATUS_TRANSITION: defineBusinessErrorCode(
    'PROPERTY_INVALID_STATUS_TRANSITION',
    {
      en: messages.en.PROPERTY_INVALID_STATUS_TRANSITION,
      vi: messages.vi.PROPERTY_INVALID_STATUS_TRANSITION,
    },
    HttpCodes.CONFLICT,
  ),
  PROPERTY_ACTIVATION_INCOMPLETE: defineBusinessErrorCode(
    'PROPERTY_ACTIVATION_INCOMPLETE',
    {
      en: messages.en.PROPERTY_ACTIVATION_INCOMPLETE,
      vi: messages.vi.PROPERTY_ACTIVATION_INCOMPLETE,
    },
    HttpCodes.BAD_REQUEST,
  ),
  PROPERTY_PUBLISHED_LISTING_CONFLICT: defineBusinessErrorCode(
    'PROPERTY_PUBLISHED_LISTING_CONFLICT',
    {
      en: messages.en.PROPERTY_PUBLISHED_LISTING_CONFLICT,
      vi: messages.vi.PROPERTY_PUBLISHED_LISTING_CONFLICT,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
