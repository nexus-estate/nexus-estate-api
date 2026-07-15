import { HttpException } from '@nestjs/common';
import { ErrorCode } from '../../utils/constants/error.constant';

export class BusinessException extends HttpException {
  public readonly errorCode: string;

  constructor(errorCode: ErrorCode, ...args: string[]) {
    let message = errorCode.message;
    args.forEach((arg) => {
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
    this.name = 'BusinessException';
  }
}
