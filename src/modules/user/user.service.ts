import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../../services/abstraction-services/base.service';
import { UserRepository } from './user.repository';
import { User } from './entities/user.entity';
import { Role } from '../rbac/entities/role.entity';
import { RegisterUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { HashHelper } from '../../common/helpers/hash.helper';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../utils/constants/error.constant';

@Injectable()
export class UserService extends BaseService<
  User,
  RegisterUserDto,
  UpdateUserDto
> {
  protected override readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {
    super(userRepository, 'User');
  }

  async handleSignUp(dto: RegisterUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing)
      throw new BusinessException(ErrorCodes.USER_EMAIL_EXISTS, dto.email);

    return this.userRepository.transaction(async (manager) => {
      const hashedPassword = await HashHelper.hash(dto.password);
      const buyerRole = await manager.findOne(Role, {
        where: { name: 'BUYER' },
      });
      if (!buyerRole)
        throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND, 'BUYER');

      const user = manager.create(User, {
        email: dto.email,
        password: hashedPassword,
        roleId: buyerRole.id,
        isEmailVerified: true,
        createdBy: 'system',
      });
      const savedUser = await manager.save(User, user);
      this.logger.log(`User created: ${savedUser.email}`);
      return savedUser;
    });
  }

  async handleFindByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async handleFindOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new BusinessException(ErrorCodes.USER_NOT_FOUND, id);
    return user;
  }

  async handleUpdate(id: string, data: UpdateUserDto): Promise<User> {
    return super.update(id, data);
  }

  async handleChangePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return this.userRepository.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) throw new BusinessException(ErrorCodes.USER_NOT_FOUND, id);
      const isValid = await HashHelper.compare(oldPassword, user.password);
      if (!isValid) throw new BusinessException(ErrorCodes.PASSWORD_INCORRECT);
      user.password = await HashHelper.hash(newPassword);
      user.updatedBy = id;
      await manager.save(User, user);
      this.logger.log(`Password changed for user: ${id}`);
      return { message: 'Password changed successfully' };
    });
  }
}
