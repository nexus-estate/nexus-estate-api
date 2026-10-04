import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';

/** Persisted event data returned after its delivery lease has committed. */
export interface ClaimedOutboxEvent {
  envelope: EventEnvelope<unknown>;
  attemptCount: number;
  leaseExpired: boolean;
}
