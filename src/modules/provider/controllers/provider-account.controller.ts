import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedPrincipal } from '../../../common/security/auth.types';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { PermissionsGuard } from '../../rbac/guard/permission.guard';
import { RoleGuard } from '../../rbac/guard/role.guard';
import { PERMISSIONS } from '../../../utils/constants/permission.constant';
import {
  CreateProviderAccountDto,
  ProviderAccountResponse,
  UpdateProviderAccountDto,
} from '../dto';
import { ProviderAccountService } from '../services/provider-account.service';
import { CustomerJwtAuthGuard } from '../../customer/guards/customer-jwt-auth.guard';

/** HTTP endpoints for the authenticated customer's provider account. */
@ApiTags('Provider Account')
@ApiBearerAuth()
@Controller('provider/account')
@UseGuards(CustomerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class ProviderAccountController {
  constructor(
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create the authenticated customer provider account',
  })
  @ApiCreatedResponse({ type: ProviderAccountResponse })
  @ApiBadRequestResponse({
    description:
      'PROVIDER_ACCOUNT_INVALID_TYPE or PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME',
  })
  @ApiConflictResponse({ description: 'PROVIDER_ACCOUNT_ALREADY_EXISTS' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_REGISTER)
  /** Creates the provider account for the authenticated customer. */
  create(
    @CurrentUser() customer: AuthenticatedPrincipal,
    @Body() dto: CreateProviderAccountDto,
  ): Promise<ProviderAccountResponse> {
    return this.providerAccountService.createForCustomer(customer.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the authenticated customer provider account' })
  @ApiOkResponse({ type: ProviderAccountResponse })
  @ApiNotFoundResponse({ description: 'PROVIDER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_READ)
  /** Returns the provider account owned by the authenticated customer. */
  getCurrent(
    @CurrentUser() customer: AuthenticatedPrincipal,
  ): Promise<ProviderAccountResponse> {
    return this.providerAccountService.getCurrent(customer.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the provider account display name' })
  @ApiOkResponse({ type: ProviderAccountResponse })
  @ApiBadRequestResponse({
    description: 'PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME',
  })
  @ApiNotFoundResponse({ description: 'PROVIDER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_UPDATE)
  /** Updates the editable profile fields of the authenticated customer's account. */
  updateCurrent(
    @CurrentUser() customer: AuthenticatedPrincipal,
    @Body() dto: UpdateProviderAccountDto,
  ): Promise<ProviderAccountResponse> {
    return this.providerAccountService.updateCurrent(customer.id, dto);
  }
}
