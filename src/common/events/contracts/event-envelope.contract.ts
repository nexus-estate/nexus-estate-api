import { assertEventRevision } from '../event-revision';
import { assertEventType } from '../event-type';

/** Versioned transport contract shared by API event producers and consumers. */
export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  /** Monotonic within the exact (aggregateType, aggregateId) stream. */
  revision: string;
  occurredAt: string;
  traceId: string | null;
  payload: TPayload;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGGREGATE_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const UTC_ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/;

/** Validates an envelope without changing or normalizing any of its fields. */
export function assertEventEnvelope<TPayload = unknown>(
  value: unknown,
): asserts value is EventEnvelope<TPayload> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Event envelope must be an object');
  }

  const envelope = value as Record<string, unknown>;
  if (
    typeof envelope.eventId !== 'string' ||
    !UUID_PATTERN.test(envelope.eventId)
  ) {
    throw new TypeError('Event ID must be a UUID');
  }
  assertEventType(envelope.eventType);
  if (
    typeof envelope.aggregateType !== 'string' ||
    !AGGREGATE_TYPE_PATTERN.test(envelope.aggregateType)
  ) {
    throw new TypeError('Aggregate type must be a lowercase logical name');
  }
  if (
    typeof envelope.aggregateId !== 'string' ||
    !UUID_PATTERN.test(envelope.aggregateId)
  ) {
    throw new TypeError('Aggregate ID must be a UUID');
  }
  assertEventRevision(envelope.revision);
  if (
    typeof envelope.occurredAt !== 'string' ||
    !isUtcIsoTimestamp(envelope.occurredAt)
  ) {
    throw new TypeError('Occurred-at must be a valid UTC ISO-8601 timestamp');
  }
  if (envelope.traceId !== null && typeof envelope.traceId !== 'string') {
    throw new TypeError('Trace ID must be a string or null');
  }
  if (
    !Object.prototype.hasOwnProperty.call(envelope, 'payload') ||
    envelope.payload === undefined
  ) {
    throw new TypeError('Event payload is required');
  }
}

function isUtcIsoTimestamp(value: string): boolean {
  const match = UTC_ISO_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(value);
  return (
    !Number.isNaN(timestamp.getTime()) &&
    timestamp.getUTCFullYear() === Number(year) &&
    timestamp.getUTCMonth() + 1 === Number(month) &&
    timestamp.getUTCDate() === Number(day) &&
    timestamp.getUTCHours() === Number(hour) &&
    timestamp.getUTCMinutes() === Number(minute) &&
    timestamp.getUTCSeconds() === Number(second)
  );
}
