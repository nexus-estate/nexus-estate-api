import { IsEmail, IsString, MinLength } from 'class-validator';

/** Credentials accepted by the internal administration portal. */
export class AdminLoginDto {
  /** Administrator email address. */
  @IsEmail()
  email: string;

  /** Administrator password. */
  @IsString()
  @MinLength(8)
  password: string;
}
