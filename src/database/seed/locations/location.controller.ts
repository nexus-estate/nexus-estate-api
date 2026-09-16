import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { locationService } from './services/location.service';
import {
  Province,
  Ward,
} from '../../../modules/location/administrative-division/entities/location.entity';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Locations')
@Controller('locations')
/** Serves reference location data used by address selection flows. */
export class locationController {
  constructor(private readonly locationService: locationService) {}

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
