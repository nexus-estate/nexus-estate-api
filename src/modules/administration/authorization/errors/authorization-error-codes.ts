import {
  defineBusinessErrorCode,
  type BusinessErrorCode,
} from '../../../../common/errors/business-error-code';
import { HttpCodes } from '../../../../common/errors/http-codes';

const error = (code: string, message: string, httpStatus: number) =>
  defineBusinessErrorCode(code, { en: message, vi: message }, httpStatus);

/** Stable errors for the authorization management plane. */
export const AuthorizationErrorCodes = {
  PLATFORM_NOT_FOUND: error(
    'AUTHORIZATION_PLATFORM_NOT_FOUND',
    'Authorization platform not found',
    HttpCodes.NOT_FOUND,
  ),
  ROLE_NOT_FOUND: error(
    'AUTHORIZATION_ROLE_NOT_FOUND',
    'Authorization role not found',
    HttpCodes.NOT_FOUND,
  ),
  ROLE_CODE_EXISTS: error(
    'AUTHORIZATION_ROLE_CODE_EXISTS',
    'Authorization role code already exists',
    HttpCodes.CONFLICT,
  ),
  ROLE_IN_USE: error(
    'AUTHORIZATION_ROLE_IN_USE',
    'Authorization role is still assigned',
    HttpCodes.CONFLICT,
  ),
  SYSTEM_ROLE_IMMUTABLE: error(
    'AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE',
    'System authorization role cannot be deleted or changed in this way',
    HttpCodes.CONFLICT,
  ),
  ROLE_VERSION_CONFLICT: error(
    'AUTHORIZATION_ROLE_VERSION_CONFLICT',
    'Authorization role was changed by another administrator',
    HttpCodes.CONFLICT,
  ),
  PERMISSION_NOT_FOUND: error(
    'AUTHORIZATION_PERMISSION_NOT_FOUND',
    'Authorization permission not found',
    HttpCodes.NOT_FOUND,
  ),
  PERMISSION_NOT_ASSIGNABLE: error(
    'AUTHORIZATION_PERMISSION_NOT_ASSIGNABLE',
    'Authorization permission cannot be assigned',
    HttpCodes.CONFLICT,
  ),
  PERMISSION_PLATFORM_MISMATCH: error(
    'AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH',
    'Authorization permission belongs to another platform',
    HttpCodes.CONFLICT,
  ),
  SUBJECT_NOT_FOUND: error(
    'AUTHORIZATION_SUBJECT_NOT_FOUND',
    'Authorization subject not found',
    HttpCodes.NOT_FOUND,
  ),
  ROLE_PLATFORM_MISMATCH: error(
    'AUTHORIZATION_ROLE_PLATFORM_MISMATCH',
    'Authorization role belongs to another platform',
    HttpCodes.CONFLICT,
  ),
  LAST_ADMIN_PROTECTION: error(
    'AUTHORIZATION_LAST_ADMIN_PROTECTION',
    'The last authorization administrator cannot be removed',
    HttpCodes.CONFLICT,
  ),
  ASSIGNMENT_CONFLICT: error(
    'AUTHORIZATION_ASSIGNMENT_CONFLICT',
    'Authorization assignment conflicts with current state',
    HttpCodes.CONFLICT,
  ),
  PROVIDER_LAST_OWNER_PROTECTION: error(
    'PROVIDER_LAST_OWNER_PROTECTION',
    'The final provider owner cannot be removed',
    HttpCodes.CONFLICT,
  ),
} as const satisfies Record<string, BusinessErrorCode>;
