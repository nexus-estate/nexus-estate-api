import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PermissionsGuard } from '../../rbac/guard/permission.guard';
import { RoleGuard } from '../../rbac/guard/role.guard';
import { PERMISSIONS } from '../../../utils/constants/permission.constant';
import { ROLES } from '../../../utils/constants/role.constant';
import { AdministrationJwtAuthGuard } from '../guards/administration-jwt-auth.guard';
import { ProviderRegistrationAdministrationService } from '../services/provider-registration-administration.service';
import { ProviderRegistrationResponse } from '../../provider/dto/provider-registration.response';
import { ProviderRegistrationReviewResponse } from '../dto/provider-registration-review.response';

/** Administrator endpoints for reviewing and approving provider requests. */
@ApiTags('Admin Provider Registrations')
@ApiBearerAuth()
@UseGuards(AdministrationJwtAuthGuard, RoleGuard, PermissionsGuard)
@Controller('administration/provider-registrations')
@RoleRequire(ROLES.ADMINISTRATOR)
@PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_APPROVE)
export class ProviderRegistrationAdministrationController {
  constructor(
    private readonly providerApprovalService: ProviderRegistrationAdministrationService,
  ) {}

  /** Lists pending provider requests with the customer data needed for review. */
  @Get()
  @ApiOperation({ summary: 'List pending provider-registration requests' })
  @ApiOkResponse({ type: ProviderRegistrationReviewResponse, isArray: true })
  findPending(): Promise<ProviderRegistrationReviewResponse[]> {
    return this.providerApprovalService.findPending();
  }

  /** Returns one pending provider request by provider-account identifier. */
  @Get(':accountId')
  @ApiOperation({ summary: 'Get a pending provider-registration request' })
  @ApiOkResponse({ type: ProviderRegistrationReviewResponse })
  findPendingById(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ): Promise<ProviderRegistrationReviewResponse> {
    return this.providerApprovalService.findPendingById(accountId);
  }

  /** Approves the request and upgrades the customer role to provider atomically. */
  @Post(':accountId/approve')
  @ApiOperation({ summary: 'Approve a provider-registration request' })
  @ApiOkResponse({ type: ProviderRegistrationResponse })
  approve(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ): Promise<ProviderRegistrationResponse> {
    return this.providerApprovalService.approve(accountId);
  }
}
