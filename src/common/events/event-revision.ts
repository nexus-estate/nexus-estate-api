export const MAX_EVENT_REVISION = '9223372036854775807';

const REVISION_PATTERN = /^[1-9][0-9]*$/;
const MAX_REVISION_VALUE = BigInt(MAX_EVENT_REVISION);

/** Rejects non-canonical or out-of-range PostgreSQL int64 revision strings. */
export function assertEventRevision(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) {
    throw new TypeError('Event revision must be a positive decimal string');
  }
  if (BigInt(value) > MAX_REVISION_VALUE) {
    throw new RangeError('Event revision exceeds PostgreSQL signed int64');
  }
}

/**
 * Compares integer revisions exactly without passing through JavaScript Number.
 * Callers must compare values from the same (aggregateType, aggregateId) stream.
 */
export function compareEventRevision(left: string, right: string): -1 | 0 | 1 {
  assertEventRevision(left);
  assertEventRevision(right);
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}
