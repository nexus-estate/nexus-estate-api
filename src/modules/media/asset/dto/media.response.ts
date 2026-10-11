import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../entities';
import type { Media } from '../entities';

/** Contract HTTP chỉ trả thông tin ảnh; không lộ các field audit của entity. */
export class MediaResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  estateId: string;

  @ApiProperty({ description: 'Object key in S3-compatible storage.' })
  mediaUrl: string;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiProperty()
  sortOrder: number;

  /** Chọn rõ các field được công khai, tránh trả nguyên persistence entity. */
  static toResponse(media: Media): MediaResponse {
    return {
      id: media.id,
      estateId: media.estateId,
      mediaUrl: media.mediaUrl,
      type: media.type,
      sortOrder: media.sortOrder,
    };
  }
}
