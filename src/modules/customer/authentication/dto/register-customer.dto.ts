import { IsEmail, IsString, MinLength } from 'class-validator';

/** Required credentials for public customer registration. */
export class RegisterCustomerDto {
  /** Email used for authentication and account ownership. */
  @IsEmail()
  email: string;

  /** Password used to authenticate the new customer. */
  @IsString()
  @MinLength(8)
  password: string;
}
