import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';
import type { AuthenticatedPrincipal } from '../types/auth.type';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly AuthService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }
  async validate(
    email: string,
    password: string,
  ): Promise<AuthenticatedPrincipal> {
    return this.AuthService.validateCredential(email, password);
  }
}
