import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox/entities/outbox-event.entity';
import { OutboxDelivery } from './outbox/entities/outbox-delivery.entity';
import { OutboxEventRepo } from './outbox/repositories/outbox-event.repo';
import { OutboxDeliveryRepo } from './outbox/repositories/outbox-delivery.repo';

/** Composes the durable outbox persistence feature without domain dependencies. */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent, OutboxDelivery])],
  providers: [OutboxEventRepo, OutboxDeliveryRepo],
  exports: [OutboxEventRepo, OutboxDeliveryRepo],
})
export class EventingModule {}
