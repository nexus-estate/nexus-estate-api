import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
