import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../../common/decorators/public.decorator';
import { LocationService } from '../services/location.service';
import { Province, Ward } from '../entities/location.entity';

/** Serves reference location data used by address selection flows. */
@ApiTags('Locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('provinces')
  @Public()
  @ApiOperation({ summary: 'List provinces' })
  async getProvinces(): Promise<Province[]> {
    return this.locationService.getAllProvinces();
  }

  @Get('provinces/:provinceId/wards')
  @Public()
  @ApiOperation({ summary: 'List wards belonging to a province' })
  @ApiParam({ name: 'provinceId', format: 'uuid' })
  async getWardsByProvince(
    @Param('provinceId', new ParseUUIDPipe()) provinceId: string,
  ): Promise<Ward[]> {
    return this.locationService.getWardsByProvinceId(provinceId);
  }
}
