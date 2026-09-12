import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes, HashHelper, ROLES } from '../../../utils';
import { RoleService } from '../../rbac/services/role.service';
import { UserService } from '../../user/service/user.service';
import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';
import type { CreateSellerFromBuyerDto } from '../dto/create-seller-from-buyer.dto';
import type { RegisterSellerDto } from '../dto/register-seller.dto';
import type { SellerRegistrationResponse } from '../dto/seller-registration.response';

/** Application service for seller onboarding and Seller Platform access. */
@Injectable()
export class SellerService {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly sellerAccountService: SellerAccountService,
  ) {}

  /**
   * Creates an independent seller user from the public registration payload.
   * The account is immediately addressable as seller but remains UNVERIFIED.
   */
  async register(dto: RegisterSellerDto): Promise<SellerRegistrationResponse> {
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
   * Creates a seller account for an existing buyer.
   *
   * This path is administrator-only at the controller boundary because a
   * public caller cannot prove ownership of an arbitrary buyerId.
   */
  async createFromBuyer(
    dto: CreateSellerFromBuyerDto,
  ): Promise<SellerRegistrationResponse> {
    const buyer = await this.userService.findById(dto.buyerId);
    if (buyer.role.name !== ROLES.BUYER) {
      throw new BusinessException(
        ErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
        'Only buyer users can be promoted to seller',
      );
    }

    const sellerRole = await this.requireRole(ROLES.SELLER);
    const sellerAccount = await this.sellerAccountService.createForUser(
      buyer.id,
      dto,
    );
    const promotedUser = await this.userService.updateRole(
      buyer.id,
      sellerRole.id,
    );

    return this.toResponse(
      promotedUser.id,
      promotedUser.role.name,
      sellerAccount,
    );
  }

  /** Returns the seller account owned by the authenticated seller. */
  getCurrent(userId: string): Promise<SellerAccountResponse> {
    return this.sellerAccountService.getCurrent(userId);
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
