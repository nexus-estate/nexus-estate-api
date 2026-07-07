import { IsOptional, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  fullName?: string;

  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  avatar?: string;

  @IsOptional()
  bio?: string;
  @IsOptional()
  lastLogin?: Date
}