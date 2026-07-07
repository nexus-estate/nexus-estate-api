import { IsEmail, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  avatar?: string;
    
  @IsOptional()
  bio?: string;
}