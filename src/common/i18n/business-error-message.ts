import type { BusinessErrorCode } from '../errors/business-error-code';
import { DEFAULT_API_LANGUAGE, type ApiLanguage } from './language';

/**
 * Resolves a module-owned BusinessErrorCode to a localized message.
 * Every error definition supplies both supported API languages explicitly.
 */
export function localizeBusinessError(
  errorCode: BusinessErrorCode,
  args: readonly string[] = [],
  language: ApiLanguage = DEFAULT_API_LANGUAGE,
): string {
  const template = errorCode.messages[language];

  return args.reduce((message, arg) => message.replace('%s', arg), template);
}
