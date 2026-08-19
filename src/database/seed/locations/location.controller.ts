import { Controller, Get } from '@nestjs/common';
import { locationService } from './services/location.service';
import { Province } from '../../../modules/location/entities/location.entity';

@Controller('locations')
export class locationController {
  constructor(private readonly locationService: locationService) {}

  @Get('provinces')
  async getProvinces(): Promise<Province[]> {
    return this.locationService.getAllProvinces();
  }
}
