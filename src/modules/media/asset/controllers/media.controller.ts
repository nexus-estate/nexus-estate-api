import {
  Controller,
  Get,
  Res,
  StreamableFile,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiProduces,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../../common/decorators/public.decorator';
import { memoryStorage } from 'multer';
import { ProviderId } from '../../../../common/decorators/provider-id.decorator';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { MediaResponse } from '../dto/media.response';
import { ImageUploadPipe, MAX_IMAGE_BYTES } from '../pipes/image-upload.pipe';
import { MediaService } from '../services/media.service';
import type { ValidatedImage } from '../types/validated-image';

/** HTTP boundary nhận một ảnh; toàn bộ quyền và persistence nằm trong service. */
@Controller('estates/:estateId/media')
@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List images of an active marketplace estate' })
  @ApiOkResponse({ type: [MediaResponse] })
  async listPublic(
    @Param('estateId', new ParseUUIDPipe()) estateId: string,
  ): Promise<MediaResponse[]> {
    return (await this.mediaService.listPublic(estateId)).map((media) =>
      MediaResponse.toResponse(media),
    );
  }

  @Get(':mediaId/content')
  @Public()
  @ApiOperation({
    summary: 'Read an image belonging to an active marketplace estate',
  })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async readPublicImage(
    @Param('estateId', new ParseUUIDPipe()) estateId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.mediaService.readPublicImage(estateId, mediaId);
    response.setHeader('Content-Type', image.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(image.body, { type: image.contentType });
  }

  /** Parse multipart và validate trước khi gọi use case tạo Media. */
  @Post()
  @ApiOperation({
    summary: 'Upload one JPEG or PNG estate image (max 5 MB)',
  })
  @ApiParam({ name: 'estateId', format: 'uuid' })
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: MediaResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Multer chặn file lớn ngay khi nhận để không giữ toàn bộ file trong RAM.
      limits: { fileSize: MAX_IMAGE_BYTES + 1, files: 1 },
    }),
  )
  async createMedia(
    @Param('estateId', new ParseUUIDPipe()) estateId: string,
    @Req() request: { user: CustomerPrincipal },
    @UploadedFile(new ImageUploadPipe()) file: ValidatedImage,
    @ProviderId() providerId?: string,
  ): Promise<MediaResponse> {
    const media = await this.mediaService.createMedia(
      request.user.id,
      estateId,
      file,
      providerId,
    );
    return MediaResponse.toResponse(media);
  }
}
