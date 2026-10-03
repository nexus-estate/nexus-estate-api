import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  assertEventEnvelope,
  type EventEnvelope,
} from '../../../../common/events/contracts/event-envelope.contract';
import { OutboxEvent } from '../entities/outbox-event.entity';

/** Persists validated event envelopes through the caller's source transaction. */
@Injectable()
export class OutboxEventRepo {
  async insert<TPayload>(
    envelope: EventEnvelope<TPayload>,
    manager: EntityManager,
  ): Promise<OutboxEvent> {
    assertEventEnvelope(envelope);

    const repository = manager.getRepository(OutboxEvent);
    const event = repository.create({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      revision: envelope.revision,
      occurredAt: new Date(envelope.occurredAt),
      traceId: envelope.traceId,
      payload: envelope.payload,
    });
    return repository.save(event);
  }
}
