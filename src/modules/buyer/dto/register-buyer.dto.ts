import { IsEmail, IsString, MinLength } from 'class-validator';

/** Required credentials for public buyer registration. */
export class RegisterBuyerDto {
  /** Email used for authentication and account ownership. */
  @IsEmail()
  email: string;

  /** Password used to authenticate the new buyer. */
  @IsString()
  @MinLength(8)
  password: string;
}
