import type { JwtService, JwtSignOptions } from '@nestjs/jwt';

type JwtExpiresIn = JwtSignOptions['expiresIn'];

export class TokenHelper {
  static async generateAccessToken(
    jwtService: JwtService,
    userId: string,
  ): Promise<string> {
    const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ||
      '15m') as JwtExpiresIn;
    return jwtService.signAsync({ sub: userId }, { expiresIn });
  }

  static async generateRefreshToken(
    jwtService: JwtService,
    userId: string,
  ): Promise<string> {
    const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ||
      '7d') as JwtExpiresIn;
    return jwtService.signAsync({ sub: userId }, { expiresIn });
  }

  static async verifyToken(
    jwtService: JwtService,
    token: string,
  ): Promise<{ sub: string }> {
    const payload = await jwtService.verifyAsync<{ sub: string }>(token);
    return { sub: payload.sub };
  }
}
