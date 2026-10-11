import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './asset/entities';
import { MediaRepository } from './asset/repositories/media.repository';
import { s3ClientProvider } from './asset/providers/s3-client.provider';
import { MediaService } from './asset/services/media.service';
import { ObjectStorageService } from './asset/services/object-storage.service';
import { EstateModule } from '../estate/estate.module';
import { CustomerModule } from '../customer/customer.module';
import { MediaController } from './asset/controllers/media.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Media]),
    EstateModule,
    CustomerModule,
  ],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    s3ClientProvider,
    ObjectStorageService,
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
