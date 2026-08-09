import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCodes } from '../utils/constants/error.constant';
import { JwtHelper } from '../utils/helpers/jwt.helper';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const baseUrl = req.baseUrl;
    if (baseUrl.startsWith('/api/v1/swagger')) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!accessToken) {
      throw new BusinessException(ErrorCodes.TOKEN_NOT_PROVIDED);
    }

    const result = await JwtHelper.verifyAccessToken(
      this.jwtService,
      accessToken,
    );

    if (!result?.user) {
      throw new BusinessException(ErrorCodes.TOKEN_INVALID);
    }

    req.user = result.user;

    next();
  }
}
