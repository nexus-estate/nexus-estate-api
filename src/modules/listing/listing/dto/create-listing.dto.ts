import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ format: 'uuid', description: 'Existing Estate to publish.' })
  @IsUUID()
  estateId: string;
}
