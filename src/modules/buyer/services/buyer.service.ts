import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes, HashHelper, ROLES } from '../../../utils';
import { RoleService } from '../../rbac/services/role.service';
import { UserService } from '../../user/service/user.service';
import type { SafeUser } from '../../user/types/user.type';
import type { RegisterBuyerDto } from '../dto/register-buyer.dto';

/** Application service for buyer registration and buyer self-service access. */
@Injectable()
export class BuyerService {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /** Creates a new buyer using the system-controlled buyer role. */
  async register(dto: RegisterBuyerDto): Promise<SafeUser> {
    const buyerRole = await this.roleService.findByName(ROLES.BUYER);
    if (!buyerRole) {
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND);
    }

    const passwordHash = await HashHelper.hash(dto.password);
    return this.userService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: buyerRole.id,
    });
  }

  /** Returns the authenticated buyer profile without exposing credentials. */
  getCurrent(userId: string): Promise<SafeUser> {
    return this.userService.findById(userId);
  }
}
