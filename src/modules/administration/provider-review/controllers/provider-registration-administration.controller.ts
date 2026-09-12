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

import { AdministrationPermissionRequire } from '../../authorization/decorators/administration-permission.decorator';
import { AdministrationPermissionsGuard } from '../../authorization/guards/administration-permissions.guard';
import { ADMINISTRATION_PERMISSIONS } from '../../authorization/constants/administration-permission.constant';
import { AdministrationJwtAuthGuard } from '../../authentication/guards/administration-jwt-auth.guard';
import { ProviderRegistrationAdministrationService } from '../services/provider-registration-administration.service';
import { ProviderRegistrationResponse } from '../../../provider/registration/dto/provider-registration.response';
import { ProviderRegistrationReviewResponse } from '../dto/provider-registration-review.response';

/** Administrator endpoints for reviewing and approving provider requests. */
@ApiTags('Admin Provider Registrations')
@ApiBearerAuth()
@UseGuards(AdministrationJwtAuthGuard, AdministrationPermissionsGuard)
@Controller('administration/provider-registrations')
@AdministrationPermissionRequire(
  ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_APPROVE,
)
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

  /** Approves the provider capability without changing customer authentication. */
  @Post(':accountId/approve')
  @ApiOperation({ summary: 'Approve a provider-registration request' })
  @ApiOkResponse({ type: ProviderRegistrationResponse })
  approve(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ): Promise<ProviderRegistrationResponse> {
    return this.providerApprovalService.approve(accountId);
  }
}
