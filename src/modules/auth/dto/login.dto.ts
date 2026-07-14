import type { LoginRequest } from '@nexus-estate/typescript-sdk';
import { IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
