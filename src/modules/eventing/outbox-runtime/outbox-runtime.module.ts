import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { typeormConfig } from '../../../database/type.config';
import { EventingModule } from '../eventing.module';
import { OutboxRuntimeController } from './controllers/outbox-runtime.controller';
import { validateOutboxEnvironment } from './helpers/outbox-environment.validation';
import { KafkaEventPublisher } from './services/kafka-event-publisher.service';
import { OutboxDispatcherService } from './services/outbox-dispatcher.service';
import { OutboxMetricsService } from './services/outbox-metrics.service';
import { EVENT_PUBLISHER } from './types/event-publisher';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [typeormConfig],
      validate: validateOutboxEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...config.getOrThrow<TypeOrmModuleOptions>('typeorm'),
        autoLoadEntities: true,
      }),
    }),
    EventingModule,
  ],
  controllers: [OutboxRuntimeController],
  providers: [
    KafkaEventPublisher,
    { provide: EVENT_PUBLISHER, useExisting: KafkaEventPublisher },
    OutboxDispatcherService,
    OutboxMetricsService,
  ],
})
export class OutboxRuntimeModule {}
