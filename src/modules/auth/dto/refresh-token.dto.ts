import type { RefreshTokenRequest } from '@nexus-estate/typescript-sdk';
import { IsString } from 'class-validator';

export class RefreshTokenDto implements RefreshTokenRequest {
  @IsString()
  refreshToken!: string;
}
