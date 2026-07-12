import { JwtService } from '@nestjs/jwt';

/**
 * Payload structure attached to Express Request by AuthMiddleware.
 */
export interface JwtUserPayload {
  id: string;
  email: string;
  roleId: string;
  role: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  roleId: string;
  role: string;
}

export class JwtHelper {
  static async verifyAccessToken(
    jwtService: JwtService,
    token: string,
  ): Promise<{ user: JwtUserPayload } | null> {
    try {
      const payload = await jwtService.verifyAsync<AccessTokenPayload>(token);

      if (!payload.sub) {
        return null;
      }

      return {
        user: {
          id: payload.sub,
          email: payload.email,
          roleId: payload.roleId,
          role: payload.role,
        },
      };
    } catch {
      return null;
    }
  }
}
