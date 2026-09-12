import { IsNotEmpty, IsString } from 'class-validator';

/** Refresh token payload for administration sessions. */
export class AdminRefreshTokenDto {
  /** Previously issued administration refresh token. */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
