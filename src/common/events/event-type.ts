const EVENT_TYPE_PATTERN =
  /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.v[1-9][0-9]*$/;

/** Returns whether a value follows `<domain>.<action>.v<major>`. */
export function isEventType(value: unknown): value is string {
  return typeof value === 'string' && EVENT_TYPE_PATTERN.test(value);
}

/** Rejects event names that are missing an explicit compatible schema version. */
export function assertEventType(value: unknown): asserts value is string {
  if (!isEventType(value)) {
    throw new TypeError(
      'Event type must use <domain>.<action>.v<major> format',
    );
  }
}
