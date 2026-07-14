import type {
  LoginResponse,
  RegisterResponse,
  RefreshTokenResponse,
} from '@nexus-estate/typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/services/user.service';
import { DataPoolService } from '../../user/services/data-pool.service';
import { User } from '../../user/entities/user.entity';
import { RegisterUserDto } from '../../user/dto/create-user-dto';
import { AuthResponseMapper } from '../mappers/auth-response.mapper';
import { TokenHelper } from '../../../common/helpers/token.helper';
import { HashHelper } from '../../../common/helpers/hash.helper';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly dataPoolService: DataPoolService,
    private readonly jwtService: JwtService,
  ) {}

  async handleValidateUser(
    identifier: string,
    password: string,
  ): Promise<User> {
    const user = await this.userService.handleFindByIdentifier(identifier);
    if (!user) throw new BusinessException(ErrorCodes.INVALID_CREDENTIALS);
    const isValid = await HashHelper.compare(password, user.password);
    if (!isValid) throw new BusinessException(ErrorCodes.INVALID_CREDENTIALS);
    return user;
  }

  async handleRegister(dto: RegisterUserDto): Promise<RegisterResponse> {
    const user = await this.userService.handleSignUp(dto);
    const sdkUser = await AuthResponseMapper.toSdkUser(
      user,
      this.dataPoolService,
    );
    return { user: sdkUser, message: 'Registration successful' };
  }

  async handleLogin(user: User): Promise<LoginResponse> {
    await this.userService.handleUpdate(user.id, {
      lastLogin: new Date(),
    });
    const accessToken = await TokenHelper.generateAccessToken(
      this.jwtService,
      user.id,
    );
    const refreshToken = await TokenHelper.generateRefreshToken(
      this.jwtService,
      user.id,
    );
    const sdkUser = await AuthResponseMapper.toSdkUser(
      user,
      this.dataPoolService,
    );
    return { user: sdkUser, accessToken, refreshToken };
  }

  async handleRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenResponse> {
    try {
      const payload = await TokenHelper.verifyToken(
        this.jwtService,
        refreshToken,
      );
      await this.userService.handleFindOne(payload.sub);
      const newAccessToken = await TokenHelper.generateAccessToken(
        this.jwtService,
        payload.sub,
      );
      const newRefreshToken = await TokenHelper.generateRefreshToken(
        this.jwtService,
        payload.sub,
      );
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new BusinessException(ErrorCodes.TOKEN_INVALID);
    }
  }

  async handleGetProfile(userId: string): Promise<User> {
    return this.userService.handleFindOne(userId);
  }

  async handleGetProfileSdk(
    userId: string,
  ): Promise<import('@nexus-estate/typescript-sdk').User> {
    const user = await this.userService.handleFindOne(userId);
    return AuthResponseMapper.toSdkUser(user, this.dataPoolService);
  }
}
