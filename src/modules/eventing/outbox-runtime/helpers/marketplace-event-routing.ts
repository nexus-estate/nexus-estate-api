import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';

export interface KafkaMarketplaceRecord {
  topic: string;
  key: string;
  value: string;
}

/** Routes Listing facts without rebuilding or wrapping their stored envelope. */
export function toMarketplaceKafkaRecord(
  topic: string,
  event: EventEnvelope<unknown>,
): KafkaMarketplaceRecord {
  if (event.aggregateType !== 'listing') {
    throw new Error(
      `Unsupported outbox aggregate type: ${event.aggregateType}`,
    );
  }
  return {
    topic,
    key: event.aggregateId,
    value: JSON.stringify(event),
  };
}
