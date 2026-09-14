/** Stable HTTP status constants used by shared and module-owned error codes. */
export const HttpCodes = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  TOO_MANY_REQUESTS: 429,
} as const;

export type HttpCode = (typeof HttpCodes)[keyof typeof HttpCodes];
