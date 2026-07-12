import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/services/user.service';
import { User } from '../../user/entities/user.entity';
import { RegisterUserDto } from '../../user/dto/create-user-dto';
import { TokenHelper } from '../../../common/helpers/token.helper';
import { HashHelper } from '../../../common/helpers/hash.helper';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
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

  async handleRegister(dto: RegisterUserDto) {
    const user = await this.userService.handleSignUp(dto);
    return { user, message: 'Registration successful' };
  }

  async handleLogin(user: User) {
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
    return { user, accessToken, refreshToken };
  }

  async handleRefreshToken(refreshToken: string) {
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
}
