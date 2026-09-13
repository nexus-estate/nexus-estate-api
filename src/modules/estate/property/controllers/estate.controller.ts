import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { Public } from '../../../../common/decorators/public.decorator';
import { ProviderId } from '../../../../common/decorators/provider-id.decorator';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateService } from '../services/estate.service';
import { ApiHeader } from '@nestjs/swagger';

type AuthenticatedRequest = {
  user: Pick<CustomerPrincipal, 'id'>;
};

@Controller('estates')
@UseGuards(CustomerJwtAuthGuard)
export class EstateController {
  constructor(private readonly estateService: EstateService) {}

  /** Creates an estate in the explicitly selected provider context. */
  @Post()
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description:
      'Required when the customer has multiple active provider memberships.',
  })
  async createEstate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEstateDto,
    @ProviderId() providerId?: string,
  ): Promise<Estate> {
    return providerId
      ? this.estateService.createEstate(req.user.id, dto, providerId)
      : this.estateService.createEstate(req.user.id, dto);
  }

  /** Lists the authenticated customer's estates. */
  @Get('mine')
  async findEstateMine(@Req() req: AuthenticatedRequest): Promise<Estate[]> {
    return this.estateService.findByCustomerId(req.user.id);
  }

  /** Returns one public estate by exact identifier. */
  @Get(':id')
  @Public()
  async findEstateById(@Param('id') estateId: string): Promise<Estate> {
    return this.estateService.findById(estateId);
  }

  /** Updates one estate after service-level ownership and provider checks. */
  @Patch(':id')
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description:
      'Required when the customer has multiple active provider memberships.',
  })
  async updateEstate(
    @Param('id') estateId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateEstateDto,
    @ProviderId() providerId?: string,
  ): Promise<Estate> {
    return providerId
      ? this.estateService.updateEstate(dto, req.user.id, estateId, providerId)
      : this.estateService.updateEstate(dto, req.user.id, estateId);
  }

  /** Soft-deletes one estate after service-level ownership and provider checks. */
  @Delete(':id')
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description:
      'Required when the customer has multiple active provider memberships.',
  })
  async deleteEstate(
    @Param('id') estateId: string,
    @Req() req: AuthenticatedRequest,
    @ProviderId() providerId?: string,
  ): Promise<boolean> {
    return providerId
      ? this.estateService.softDeleteEstate(req.user.id, estateId, providerId)
      : this.estateService.softDeleteEstate(req.user.id, estateId);
  }
}
