/** Calculates capped exponential retry delay with bounded positive jitter. */
export function calculateOutboxRetryDelay(
  attemptCount: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new Error('attemptCount must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(baseMs) ||
    !Number.isSafeInteger(maxMs) ||
    baseMs < 1 ||
    maxMs < baseMs
  ) {
    throw new Error('retry bounds must be positive integers with max >= base');
  }

  const exponent = attemptCount - 1;
  const capExponent = Math.ceil(Math.log2(maxMs / baseMs));
  const exponential = exponent >= capExponent ? maxMs : baseMs * 2 ** exponent;
  const jitterRange = Math.min(baseMs, maxMs - exponential);
  const jitterSample = Math.min(0.999_999_999, Math.max(0, random()));
  return Math.min(maxMs, Math.floor(exponential + jitterSample * jitterRange));
}
