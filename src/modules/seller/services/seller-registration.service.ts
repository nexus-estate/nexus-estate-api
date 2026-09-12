import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { HashHelper } from '../../../utils/helpers/hash.helper';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { SellerAccountErrorCodes } from '../../seller-platform/account/errors/seller-account-error-codes';
import { RoleService } from '../../rbac/services/role.service';
import { BuyerAccountService } from '../../buyer/account/services/buyer-account.service';
import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';
import type { RegisterSellerFromBuyerDto } from '../dto/register-seller-from-buyer.dto';
import type { RegisterSellerDto } from '../dto/register-seller.dto';
import type { SellerRegistrationResponse } from '../dto/seller-registration.response';

/** Handles seller registration and buyer-to-seller registration requests. */
@Injectable()
export class SellerRegistrationService {
  constructor(
    private readonly buyerAccountService: BuyerAccountService,
    private readonly roleService: RoleService,
    private readonly sellerAccountService: SellerAccountService,
  ) {}

  /** Creates an independent seller buyer without a buyer approval request. */
  async registerIndependent(
    dto: RegisterSellerDto,
  ): Promise<SellerRegistrationResponse> {
    const sellerRole = await this.requireRole(ROLES.SELLER);
    const passwordHash = await HashHelper.hash(dto.password);
    const buyerAccount = await this.buyerAccountService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: sellerRole.id,
    });
    const sellerAccount = await this.sellerAccountService.createForBuyer(
      buyerAccount.id,
      dto,
    );

    return this.toResponse(
      buyerAccount.id,
      buyerAccount.role.name,
      sellerAccount,
    );
  }

  /**
   * Creates a pending seller account for the authenticated buyer.
   *
   * The buyer remains a buyer until an administrator approves the request.
   */
  async requestFromBuyer(
    authenticatedBuyerId: string,
    dto: RegisterSellerFromBuyerDto,
  ): Promise<SellerRegistrationResponse> {
    if (authenticatedBuyerId !== dto.buyerId) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
        'A buyer can only submit a request for their own buyer account',
      );
    }

    const buyer = await this.buyerAccountService.findById(dto.buyerId);
    if (buyer.role.name !== ROLES.BUYER) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
        'Only buyer users can submit a seller-registration request',
      );
    }

    const sellerAccount = await this.sellerAccountService.createPendingForBuyer(
      buyer.id,
      dto,
    );

    return this.toResponse(buyer.id, buyer.role.name, sellerAccount);
  }

  private async requireRole(roleName: string) {
    const role = await this.roleService.findByName(roleName);
    if (!role) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }
    return role;
  }

  private toResponse(
    buyerId: string,
    role: string,
    sellerAccount: SellerAccountResponse,
  ): SellerRegistrationResponse {
    return { buyerId, role, sellerAccount };
  }
}
