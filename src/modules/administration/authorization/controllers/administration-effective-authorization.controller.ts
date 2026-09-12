import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AdministrationPrincipal } from '../../../../common/security/auth.types';
import { AdministrationJwtAuthGuard } from '../../authentication/guards/administration-jwt-auth.guard';
import { AuthorizationEffectiveService } from '../services/authorization-effective.service';

/** Returns only the current administrator's effective authorization state. */
@Controller('administration/me')
@ApiTags('Administration Authorization')
@ApiBearerAuth()
@UseGuards(AdministrationJwtAuthGuard)
export class AdministrationEffectiveAuthorizationController {
  constructor(private readonly service: AuthorizationEffectiveService) {}

  @Get('authorization')
  @ApiOperation({ summary: 'Get current administrator effective permissions' })
  effective(@CurrentUser() principal: AdministrationPrincipal) {
    return this.service.effective(principal.id);
  }
}
