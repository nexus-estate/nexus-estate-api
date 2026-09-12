/** Localized messages owned by the module that defines a business error. */
export interface BusinessErrorMessages {
  en: string;
  vi: string;
}

/** Stable HTTP error contract shared by all module-owned error definitions. */
export interface BusinessErrorCode {
  code: string;
  message: string;
  messages: BusinessErrorMessages;
  httpStatus: number;
}

/** Creates a typed module-owned business error definition. */
export function defineBusinessErrorCode(
  code: string,
  messages: BusinessErrorMessages,
  httpStatus: number,
): BusinessErrorCode {
  return {
    code,
    message: messages.en,
    messages,
    httpStatus,
  };
}
