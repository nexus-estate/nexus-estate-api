import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/service/user.service';
import type {
  AuthenticatedPrincipal,
  JwtPayload,
  TokenPair,
} from '../types/auth.type';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes, HashHelper } from '../../../utils';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { SafeUser } from '../../user/types/user.type';
import { RoleService } from '../../rbac/services/role.service';
import { RegisterDto } from '../dto/register.dto';
import { CreateUserInput } from '../../user/dto/user.dto';
type JwtExpiresIn = JwtSignOptions['expiresIn'];
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly roleService: RoleService,
  ) {}
  //LOGIN
  async validateCredential(
    email: string,
    password: string,
  ): Promise<AuthenticatedPrincipal> {
    const user = await this.userService.findByEmailForAuthentication(email);
    if (!user) {
      throw new BusinessException(ErrorCodes.INVALID_CREDENTIALS);
    }
    const isPasswordValid = await HashHelper.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BusinessException(ErrorCodes.INVALID_CREDENTIALS);
    }
    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
    };
  }
  async handleLogin(user: AuthenticatedPrincipal): Promise<TokenPair> {
    const TokenPair = await this.generateTokenPair(user);
    await this.userService.updateLastLogin(user.id, new Date());
    return TokenPair;
  }
  async handleRegister(dto: RegisterDto): Promise<SafeUser> {
    const role = await this.roleService.findByName('BUYER');
    if (!role) {
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND);
    }
    const passwordHash = await HashHelper.hash(dto.password);

    const createUserInput: CreateUserInput = {
      email: dto.email,
      passwordHash,
      roleId: role.id,
    };

    return this.userService.handleCreate(createUserInput);
  }

  // REFRESHTOKEN
  private async generateTokenPair(
    user: AuthenticatedPrincipal,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      type: 'refresh',
    };

    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as JwtExpiresIn;

    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as JwtExpiresIn;

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async handleRefreshtoken(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new BusinessException(ErrorCodes.TOKEN_INVALID);
    }
    const user = await this.userService.findById(payload.sub);
    const principal: AuthenticatedPrincipal = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
    };
    return this.generateTokenPair(principal);
  }
}
