import { Controller, Get } from '@nestjs/common';
import { locationService } from './services/location.service';
import { Province } from '../../../modules/location/administrative-division/entities/location.entity';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('locations')
export class locationController {
  constructor(private readonly locationService: locationService) {}

  @Get('provinces')
  @Public()
  async getProvinces(): Promise<Province[]> {
    return this.locationService.getAllProvinces();
  }
}
