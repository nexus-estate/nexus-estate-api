import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';
import messages from './messages.json';

/** Stable upload validation errors owned by the media asset feature. */
export const MediaErrorCodes = {
  MEDIA_IMAGE_REQUIRED: defineBusinessErrorCode(
    'MEDIA_IMAGE_REQUIRED',
    {
      en: messages.en.MEDIA_IMAGE_REQUIRED,
      vi: messages.vi.MEDIA_IMAGE_REQUIRED,
    },
    HttpCodes.BAD_REQUEST,
  ),
  MEDIA_IMAGE_TOO_LARGE: defineBusinessErrorCode(
    'MEDIA_IMAGE_TOO_LARGE',
    {
      en: messages.en.MEDIA_IMAGE_TOO_LARGE,
      vi: messages.vi.MEDIA_IMAGE_TOO_LARGE,
    },
    HttpCodes.PAYLOAD_TOO_LARGE,
  ),
  MEDIA_INVALID_IMAGE_UPLOAD: defineBusinessErrorCode(
    'MEDIA_INVALID_IMAGE_UPLOAD',
    {
      en: messages.en.MEDIA_INVALID_IMAGE_UPLOAD,
      vi: messages.vi.MEDIA_INVALID_IMAGE_UPLOAD,
    },
    HttpCodes.BAD_REQUEST,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
