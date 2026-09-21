import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { EstateResponse } from '../dto/estate.response';
import { EstateService } from '../services/estate.service';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

type AuthenticatedRequest = {
  user: Pick<CustomerPrincipal, 'id'>;
};

@Controller('estates')
@ApiTags('Estates')
@UseGuards(CustomerJwtAuthGuard)
export class EstateController {
  constructor(private readonly estateService: EstateService) {}

  /** Creates an estate in the explicitly selected provider context. */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an estate' })
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
  ): Promise<EstateResponse> {
    const estate = await this.estateService.createEstate(
      req.user.id,
      dto,
      providerId,
    );
    return EstateResponse.toResponse(estate);
  }

  /** Lists the provider-scoped estates of the authenticated customer. */
  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the resolved provider context's estates" })
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description: 'Provider context used to scope the estate list.',
  })
  @ApiOkResponse({ type: [EstateResponse] })
  async findEstateMine(
    @Req() req: AuthenticatedRequest,
    @ProviderId() providerId?: string,
  ): Promise<EstateResponse[]> {
    const estates = await this.estateService.listMine(req.user.id, providerId);
    return estates.map((estate) => EstateResponse.toResponse(estate));
  }

  /** Returns one public estate by exact identifier. */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get an estate by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EstateResponse })
  async findEstateById(
    @Param('id', new ParseUUIDPipe()) estateId: string,
  ): Promise<EstateResponse> {
    const estate = await this.estateService.findById(estateId);
    return EstateResponse.toResponse(estate);
  }

  /** Updates one estate after service-level ownership and provider checks. */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an estate' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description:
      'Required when the customer has multiple active provider memberships.',
  })
  async updateEstate(
    @Param('id', new ParseUUIDPipe()) estateId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateEstateDto,
    @ProviderId() providerId?: string,
  ): Promise<EstateResponse> {
    const estate = await this.estateService.updateEstate(
      dto,
      req.user.id,
      estateId,
      providerId,
    );
    return EstateResponse.toResponse(estate);
  }

  /** Soft-deletes one estate after service-level ownership and provider checks. */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete an estate' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'X-Provider-Id',
    required: false,
    description:
      'Required when the customer has multiple active provider memberships.',
  })
  async deleteEstate(
    @Param('id', new ParseUUIDPipe()) estateId: string,
    @Req() req: AuthenticatedRequest,
    @ProviderId() providerId?: string,
  ): Promise<boolean> {
    return this.estateService.softDeleteEstate(
      req.user.id,
      estateId,
      providerId,
    );
  }
}
