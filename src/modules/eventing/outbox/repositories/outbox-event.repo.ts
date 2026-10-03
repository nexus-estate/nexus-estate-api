import { Injectable } from '@nestjs/common';
import type { EntityManager, QueryDeepPartialEntity } from 'typeorm';
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
  ): Promise<void> {
    assertEventEnvelope(envelope);

    await manager.getRepository(OutboxEvent).insert({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      revision: envelope.revision,
      occurredAt: new Date(envelope.occurredAt),
      traceId: envelope.traceId,
      payload:
        envelope.payload as QueryDeepPartialEntity<OutboxEvent>['payload'],
    });
  }
}
