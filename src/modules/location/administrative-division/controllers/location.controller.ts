import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';

import { Public } from '../../../../common/decorators/public.decorator';
import { LocationService } from '../services/location.service';
import { Province, Ward } from '../entities/location.entity';
import { AdministrativeUnitResponse } from '../dto/location.dto';

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
  /** Lists only phường for the selected province. */
  @Get('provinces/:provinceId/urban-wards')
  @Public()
  @ApiOperation({ summary: 'List phường belonging to a province' })
  @ApiParam({ name: 'provinceId', format: 'uuid' })
  @ApiOkResponse({ type: AdministrativeUnitResponse, isArray: true })
  getUrbanWards(
    @Param('provinceId', new ParseUUIDPipe()) provinceId: string,
  ): Promise<AdministrativeUnitResponse[]> {
    return this.locationService.getUnitsByType(provinceId, 'ward');
  }

  /** Lists only xã for the selected province. */
  @Get('provinces/:provinceId/communes')
  @Public()
  @ApiOperation({ summary: 'List xã belonging to a province' })
  @ApiParam({ name: 'provinceId', format: 'uuid' })
  @ApiOkResponse({ type: AdministrativeUnitResponse, isArray: true })
  getCommunes(
    @Param('provinceId', new ParseUUIDPipe()) provinceId: string,
  ): Promise<AdministrativeUnitResponse[]> {
    return this.locationService.getUnitsByType(provinceId, 'commune');
  }

  /** Lists only đặc khu for the selected province. */
  @Get('provinces/:provinceId/special-zones')
  @Public()
  @ApiOperation({ summary: 'List đặc khu belonging to a province' })
  @ApiParam({ name: 'provinceId', format: 'uuid' })
  @ApiOkResponse({ type: AdministrativeUnitResponse, isArray: true })
  getSpecialZones(
    @Param('provinceId', new ParseUUIDPipe()) provinceId: string,
  ): Promise<AdministrativeUnitResponse[]> {
    return this.locationService.getUnitsByType(provinceId, 'special_zone');
  }
}
