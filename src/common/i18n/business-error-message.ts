import type { BusinessErrorCode } from '../errors/business-error-code';
import { DEFAULT_API_LANGUAGE, type ApiLanguage } from './language';

/**
 * Resolves a module-owned BusinessErrorCode to a localized message.
 * Missing translations fall back to the code's English/default message.
 */
export function localizeBusinessError(
  errorCode: BusinessErrorCode,
  args: readonly string[] = [],
  language: ApiLanguage = DEFAULT_API_LANGUAGE,
): string {
  const template = errorCode.messages[language] ?? errorCode.message;

  return args.reduce((message, arg) => message.replace('%s', arg), template);
}
