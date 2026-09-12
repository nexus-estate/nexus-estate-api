import { validate, ValidationError } from 'class-validator';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { BusinessException } from '../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../common/errors/common-error-codes';

export class ValidationHelper {
  static async validate<T extends object>(
    dtoClass: ClassConstructor<T>,
    plain: unknown,
  ): Promise<T> {
    const dto = plainToInstance(dtoClass, plain);
    const errors = await validate(dto as object);
    if (errors.length > 0) {
      const messages = ValidationHelper.formatErrors(errors);
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        messages.join('; '),
      );
    }
    return dto;
  }

  private static formatErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];
    for (const error of errors) {
      if (error.constraints) messages.push(...Object.values(error.constraints));
      if (error.children?.length)
        messages.push(...ValidationHelper.formatErrors(error.children));
    }
    return messages;
  }
}
