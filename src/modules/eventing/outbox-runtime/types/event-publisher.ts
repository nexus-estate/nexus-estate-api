import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/** Transports an immutable persisted envelope and waits for broker ACK. */
export interface EventPublisher {
  connect(): Promise<void>;
  publish(event: EventEnvelope<unknown>): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
