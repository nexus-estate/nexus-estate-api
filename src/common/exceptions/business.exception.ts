import { HttpException } from '@nestjs/common';
import { BusinessErrorCode } from '../errors/business-error-code';

export class BusinessException extends HttpException {
  public readonly errorCode: string;
  public readonly errorDefinition: BusinessErrorCode;
  public readonly messageArgs: readonly string[];
  public readonly details: Record<string, unknown>;

  constructor(
    errorCode: BusinessErrorCode,
    ...args: Array<string | Record<string, unknown>>
  ) {
    const lastArg = args.at(-1);
    const details =
      lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)
        ? lastArg
        : {};
    const messageArgs = args.filter(
      (arg): arg is string => typeof arg === 'string',
    );
    let message = errorCode.message;
    messageArgs.forEach((arg) => {
      message = message.replace('%s', arg);
    });

    super(
      {
        statusCode: errorCode.httpStatus,
        code: errorCode.code,
        message,
        ...(Object.keys(details).length > 0 ? { details } : {}),
      },
      errorCode.httpStatus,
    );

    this.errorCode = errorCode.code;
    this.errorDefinition = errorCode;
    this.messageArgs = messageArgs;
    this.name = 'BusinessException';
    this.details = details;
  }
}
