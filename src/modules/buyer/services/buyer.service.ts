import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { HashHelper } from '../../../utils/helpers/hash.helper';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { RoleService } from '../../rbac/services/role.service';
import { BuyerAccountService } from '../account/services/buyer-account.service';
import type { SafeBuyerAccount } from '../account/types/buyer-account.type';
import type { RegisterBuyerDto } from '../dto/register-buyer.dto';

/** Application service for buyer registration and buyer self-service access. */
@Injectable()
export class BuyerService {
  constructor(
    private readonly buyerAccountService: BuyerAccountService,
    private readonly roleService: RoleService,
  ) {}

  /** Creates a new buyer using the system-controlled buyer role. */
  async register(dto: RegisterBuyerDto): Promise<SafeBuyerAccount> {
    const buyerRole = await this.roleService.findByName(ROLES.BUYER);
    if (!buyerRole) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }

    const passwordHash = await HashHelper.hash(dto.password);
    return this.buyerAccountService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: buyerRole.id,
    });
  }

  /** Returns the authenticated buyer profile without exposing credentials. */
  getCurrent(buyerId: string): Promise<SafeBuyerAccount> {
    return this.buyerAccountService.findById(buyerId);
  }
}
