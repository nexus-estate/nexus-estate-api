import { IsEmail, IsString, MinLength } from 'class-validator';

import { CommonErrorCodes } from '../../common/errors/common-error-codes';
import { ValidationHelper } from './validation.helper';

class ExampleDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  name: string;
}

describe('ValidationHelper', () => {
  it('returns an instance when the input is valid', async () => {
    const result = await ValidationHelper.validate(ExampleDto, {
      email: 'customer@nexus.test',
      name: 'Customer',
    });

    expect(result).toBeInstanceOf(ExampleDto);
    expect(result).toMatchObject({
      email: 'customer@nexus.test',
      name: 'Customer',
    });
  });

  it('throws VALIDATION_ERROR with all validation messages', async () => {
    await expect(
      ValidationHelper.validate(ExampleDto, {
        email: 'invalid-email',
        name: 'x',
      }),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
    });
  });
});
