import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdministrationJwtAuthGuard } from '../../authentication/guards/administration-jwt-auth.guard';
import { AdministrationPermissionRequire } from '../decorators/administration-permission.decorator';
import { AdministrationPermissionsGuard } from '../guards/administration-permissions.guard';
import { ADMINISTRATION_PERMISSIONS } from '../constants/administration-permission.constant';
import { AuthorizationSubjectListQueryDto } from '../dto/authorization-management.dto';
import { AuthorizationProviderMembershipService } from '../services/subjects/authorization-provider-membership.service';
import type { AuthorizationProviderMemberListResult } from '../types/contracts/authorization-management.contract';

/** Read-only provider membership view required by authorization management UI. */
@ApiTags('Administration Provider Memberships')
@ApiBearerAuth()
@Controller('administration/providers')
@UseGuards(AdministrationJwtAuthGuard, AdministrationPermissionsGuard)
export class ProviderMembershipAuthorizationController {
  constructor(
    private readonly service: AuthorizationProviderMembershipService,
  ) {}

  @Get(':providerId/members')
  @ApiOperation({
    summary: 'List provider memberships for authorization management',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  /** Lists provider memberships visible to an authorized administrator. */
  members(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
    @Query() query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationProviderMemberListResult> {
    return this.service.list(providerId, query);
  }
}
