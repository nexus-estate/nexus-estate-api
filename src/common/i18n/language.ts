/** Supported API response languages. */
export const API_LANGUAGES = ['en', 'vi'] as const;

export type ApiLanguage = (typeof API_LANGUAGES)[number];

/** Header used by clients to select the API response language. */
export const API_LANGUAGE_HEADER = 'x-lang';

/** Default language used when the header is absent or unsupported. */
export const DEFAULT_API_LANGUAGE: ApiLanguage = 'en';

/**
 * Resolves a client language header to the supported two-letter language.
 * Regional values such as `en-US` and `vi-VN` are accepted.
 */
export function resolveApiLanguage(value: unknown): ApiLanguage {
  let headerValue: unknown = value;
  if (Array.isArray(value)) {
    headerValue = (value as unknown[])[0];
  }
  if (typeof headerValue !== 'string') {
    return DEFAULT_API_LANGUAGE;
  }

  const language = headerValue.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'vi' ? 'vi' : DEFAULT_API_LANGUAGE;
}
