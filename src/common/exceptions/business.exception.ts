import { HttpException } from '@nestjs/common';
import { BusinessErrorCode } from '../errors/business-error-code';

export class BusinessException extends HttpException {
  public readonly errorCode: string;
  public readonly errorDefinition: BusinessErrorCode;
  public readonly messageArgs: readonly string[];

  constructor(errorCode: BusinessErrorCode, ...args: string[]) {
    const messageArgs = [...args];
    let message = errorCode.message;
    messageArgs.forEach((arg) => {
      message = message.replace('%s', arg);
    });

    super(
      {
        statusCode: errorCode.httpStatus,
        code: errorCode.code,
        message,
      },
      errorCode.httpStatus,
    );

    this.errorCode = errorCode.code;
    this.errorDefinition = errorCode;
    this.messageArgs = messageArgs;
    this.name = 'BusinessException';
  }
}
