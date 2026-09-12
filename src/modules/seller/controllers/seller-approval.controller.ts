import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PERMISSIONS, ROLES } from '../../../utils';
import { SellerApprovalService } from '../services/seller-approval.service';
import { SellerRegistrationResponse } from '../dto/seller-registration.response';
import { SellerRegistrationReviewResponse } from '../dto/seller-registration-review.response';

/** Administrator endpoints for reviewing and approving seller requests. */
@ApiTags('Admin Seller Registrations')
@ApiBearerAuth()
@Controller('admin/seller-registrations')
@RoleRequire(ROLES.ADMINISTRATOR)
@PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_APPROVE)
export class SellerApprovalController {
  constructor(private readonly sellerApprovalService: SellerApprovalService) {}

  /** Lists pending seller requests with the buyer data needed for review. */
  @Get()
  @ApiOperation({ summary: 'List pending seller-registration requests' })
  @ApiOkResponse({ type: SellerRegistrationReviewResponse, isArray: true })
  findPending(): Promise<SellerRegistrationReviewResponse[]> {
    return this.sellerApprovalService.findPending();
  }

  /** Returns one pending seller request by seller-account identifier. */
  @Get(':accountId')
  @ApiOperation({ summary: 'Get a pending seller-registration request' })
  @ApiOkResponse({ type: SellerRegistrationReviewResponse })
  findPendingById(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ): Promise<SellerRegistrationReviewResponse> {
    return this.sellerApprovalService.findPendingById(accountId);
  }

  /** Approves the request and upgrades the buyer role to seller atomically. */
  @Post(':accountId/approve')
  @ApiOperation({ summary: 'Approve a seller-registration request' })
  @ApiOkResponse({ type: SellerRegistrationResponse })
  approve(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ): Promise<SellerRegistrationResponse> {
    return this.sellerApprovalService.approve(accountId);
  }
}
