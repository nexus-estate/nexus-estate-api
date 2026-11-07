import { ApiProperty } from '@nestjs/swagger';
import type { WardType } from '../entities/location.entity';

/** Reference selection contract; excludes persistence audit fields. */
export class AdministrativeUnitResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['ward', 'commune', 'special_zone'] }) type: WardType;
  @ApiProperty({ format: 'uuid' }) provinceId: string;
}
