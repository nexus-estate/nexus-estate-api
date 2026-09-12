import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes, HashHelper, ROLES } from '../../../utils';
import { RoleService } from '../../rbac/services/role.service';
import { UserService } from '../../user/service/user.service';
import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';
import type { RegisterSellerFromBuyerDto } from '../dto/register-seller-from-buyer.dto';
import type { RegisterSellerDto } from '../dto/register-seller.dto';
import type { SellerRegistrationResponse } from '../dto/seller-registration.response';

/** Handles seller registration and buyer-to-seller registration requests. */
@Injectable()
export class SellerRegistrationService {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly sellerAccountService: SellerAccountService,
  ) {}

  /** Creates an independent seller user without a buyer approval request. */
  async registerIndependent(
    dto: RegisterSellerDto,
  ): Promise<SellerRegistrationResponse> {
    const sellerRole = await this.requireRole(ROLES.SELLER);
    const passwordHash = await HashHelper.hash(dto.password);
    const user = await this.userService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: sellerRole.id,
    });
    const sellerAccount = await this.sellerAccountService.createForUser(
      user.id,
      dto,
    );

    return this.toResponse(user.id, user.role.name, sellerAccount);
  }

  /**
   * Creates a pending seller account for the authenticated buyer.
   *
   * The user remains a buyer until an administrator approves the request.
   */
  async requestFromBuyer(
    authenticatedUserId: string,
    dto: RegisterSellerFromBuyerDto,
  ): Promise<SellerRegistrationResponse> {
    if (authenticatedUserId !== dto.buyerId) {
      throw new BusinessException(
        ErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
        'A buyer can only submit a request for their own user account',
      );
    }

    const buyer = await this.userService.findById(dto.buyerId);
    if (buyer.role.name !== ROLES.BUYER) {
      throw new BusinessException(
        ErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
        'Only buyer users can submit a seller-registration request',
      );
    }

    const sellerAccount = await this.sellerAccountService.createPendingForUser(
      buyer.id,
      dto,
    );

    return this.toResponse(buyer.id, buyer.role.name, sellerAccount);
  }

  private async requireRole(roleName: string) {
    const role = await this.roleService.findByName(roleName);
    if (!role) {
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND);
    }
    return role;
  }

  private toResponse(
    userId: string,
    role: string,
    sellerAccount: SellerAccountResponse,
  ): SellerRegistrationResponse {
    return { userId, role, sellerAccount };
  }
}
