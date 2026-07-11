/**
 * Standardized error codes and messages for the API Gateway.
 *
 * Each error code includes:
 * - `code`: Machine-readable identifier (used in client error handling)
 * - `message`: Human-readable description (supports `%s` for dynamic values)
 * - `httpStatus`: HTTP status code
 */
export interface ErrorCode {
  code: string;
  message: string;
  httpStatus: number;
}

export const ErrorCodes = {
  // ─── Authentication & Authorization ───────────────────────────────
  UNAUTHORIZED: {
    code: 'AUTH_001',
    message: 'Authentication required. Please provide a valid token.',
    httpStatus: 401,
  },

  INVALID_CREDENTIALS: {
    code: 'AUTH_002',
    message: 'Invalid email or password.',
    httpStatus: 401,
  },

  TOKEN_EXPIRED: {
    code: 'AUTH_003',
    message: 'Token has expired. Please refresh your token.',
    httpStatus: 401,
  },

  TOKEN_INVALID: {
    code: 'AUTH_004',
    message: 'Token is invalid or malformed.',
    httpStatus: 401,
  },

  FORBIDDEN: {
    code: 'AUTH_005',
    message: 'You do not have permission to perform this action.',
    httpStatus: 403,
  },

  ROLE_REQUIRED: {
    code: 'AUTH_006',
    message: 'Role %s is required to access this resource.',
    httpStatus: 403,
  },

  PERMISSION_REQUIRED: {
    code: 'AUTH_007',
    message: 'Permission %s is required to perform this action.',
    httpStatus: 403,
  },

  // ─── User & Account ──────────────────────────────────────────────
  USER_NOT_FOUND: {
    code: 'USR_001',
    message: 'User with id %s not found.',
    httpStatus: 404,
  },

  USER_EMAIL_EXISTS: {
    code: 'USR_002',
    message: 'A user with email %s already exists.',
    httpStatus: 409,
  },

  USER_NOT_FOUND_BY_EMAIL: {
    code: 'USR_003',
    message: 'No user found with email %s.',
    httpStatus: 404,
  },

  PASSWORD_INCORRECT: {
    code: 'USR_004',
    message: 'Current password is incorrect.',
    httpStatus: 400,
  },

  PASSWORD_WEAK: {
    code: 'USR_005',
    message: 'Password must be at least 6 characters.',
    httpStatus: 400,
  },

  // ─── Role & Permission ───────────────────────────────────────────
  ROLE_NOT_FOUND: {
    code: 'RLE_001',
    message: 'Role with id %s not found.',
    httpStatus: 404,
  },

  ROLE_NAME_EXISTS: {
    code: 'RLE_002',
    message: 'Role with name %s already exists.',
    httpStatus: 409,
  },

  PERMISSION_NOT_FOUND: {
    code: 'PER_001',
    message: 'Permission with id %s not found.',
    httpStatus: 404,
  },

  PERMISSION_EXISTS: {
    code: 'PER_002',
    message: 'Permission %s already exists for this role.',
    httpStatus: 409,
  },

  // ─── Validation ──────────────────────────────────────────────────
  VALIDATION_ERROR: {
    code: 'VAL_001',
    message: 'Validation failed: %s',
    httpStatus: 400,
  },

  INVALID_UUID: {
    code: 'VAL_002',
    message: '%s is not a valid UUID.',
    httpStatus: 400,
  },

  INVALID_PAGINATION: {
    code: 'VAL_003',
    message:
      'Pagination parameters are invalid. Page must be >= 1, limit must be between 1 and 100.',
    httpStatus: 400,
  },

  // ─── Resource ────────────────────────────────────────────────────
  RESOURCE_NOT_FOUND: {
    code: 'RES_001',
    message: 'Resource %s with id %s not found.',
    httpStatus: 404,
  },

  RESOURCE_CONFLICT: {
    code: 'RES_002',
    message: 'Resource %s already exists.',
    httpStatus: 409,
  },

  // ─── System ──────────────────────────────────────────────────────
  INTERNAL_ERROR: {
    code: 'SYS_001',
    message: 'An unexpected error occurred. Please try again later.',
    httpStatus: 500,
  },

  DATABASE_ERROR: {
    code: 'SYS_002',
    message: 'Database operation failed: %s',
    httpStatus: 500,
  },

  RATE_LIMIT_EXCEEDED: {
    code: 'SYS_003',
    message: 'Too many requests. Please try again later.',
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorCode>;

export type ErrorCodeName = keyof typeof ErrorCodes;
