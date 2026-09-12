import messages from './messages.json';
import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';

const rbacMessages = messages;

/** Role and permission errors owned by the RBAC module. */
export const RbacErrorCodes = {
  ROLE_NOT_FOUND: defineBusinessErrorCode(
    'ROLE_NOT_FOUND',
    { en: rbacMessages.en.ROLE_NOT_FOUND, vi: rbacMessages.vi.ROLE_NOT_FOUND },
    HttpCodes.NOT_FOUND,
  ),
  ROLE_NAME_EXISTS: defineBusinessErrorCode(
    'ROLE_NAME_EXISTS',
    {
      en: rbacMessages.en.ROLE_NAME_EXISTS,
      vi: rbacMessages.vi.ROLE_NAME_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
  PERMISSION_NOT_FOUND: defineBusinessErrorCode(
    'PERMISSION_NOT_FOUND',
    {
      en: rbacMessages.en.PERMISSION_NOT_FOUND,
      vi: rbacMessages.vi.PERMISSION_NOT_FOUND,
    },
    HttpCodes.NOT_FOUND,
  ),
  PERMISSION_EXISTS: defineBusinessErrorCode(
    'PERMISSION_EXISTS',
    {
      en: rbacMessages.en.PERMISSION_EXISTS,
      vi: rbacMessages.vi.PERMISSION_EXISTS,
    },
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
