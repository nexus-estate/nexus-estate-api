import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox/entities/outbox-event.entity';
import { OutboxEventRepo } from './outbox/repositories/outbox-event.repo';

/** Composes the durable outbox persistence feature without domain dependencies. */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxEventRepo],
  exports: [OutboxEventRepo],
})
export class EventingModule {}
