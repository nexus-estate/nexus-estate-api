import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { Public } from '../../../common/decorators/public.decorator';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateService } from '../services/estate.service';

type AuthenticatedRequest = {
  user: AuthenticatedPrincipal;
};

@Controller('estates')
export class EstateController {
  constructor(private readonly estateService: EstateService) {}

  @Post()
  async createEstate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEstateDto,
  ): Promise<Estate> {
    return this.estateService.createEstate(req.user.id, dto);
  }

  @Get('mine')
  async findEstateMine(@Req() req: AuthenticatedRequest): Promise<Estate[]> {
    return this.estateService.findByUserId(req.user.id);
  }

  @Get(':id')
  @Public()
  async findEstateById(@Param('id') estateId: string): Promise<Estate> {
    return this.estateService.findById(estateId);
  }

  @Patch(':id')
  async updateEstate(
    @Param('id') estateId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateEstateDto,
  ): Promise<Estate> {
    return this.estateService.updateEstate(dto, req.user.id, estateId);
  }

  @Delete(':id')
  async deleteEstate(
    @Param('id') estateId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<boolean> {
    return this.estateService.softDeleteEstate(req.user.id, estateId);
  }
}
