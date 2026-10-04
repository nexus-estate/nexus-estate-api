import { calculateOutboxRetryDelay } from './outbox-retry';

describe('calculateOutboxRetryDelay', () => {
  it('uses capped exponential backoff with bounded positive jitter', () => {
    expect(calculateOutboxRetryDelay(1, 1_000, 10_000, () => 0.5)).toBe(1_500);
    expect(calculateOutboxRetryDelay(2, 1_000, 10_000, () => 0.5)).toBe(2_500);
    expect(calculateOutboxRetryDelay(4, 1_000, 10_000, () => 0.999)).toBe(
      8_999,
    );
  });

  it('never exceeds the configured cap, including very large attempts', () => {
    expect(calculateOutboxRetryDelay(5, 1_000, 10_000, () => 1)).toBe(10_000);
    expect(calculateOutboxRetryDelay(2_000_000, 1_000, 10_000)).toBe(10_000);
  });

  it('rejects invalid attempt and retry bounds', () => {
    expect(() => calculateOutboxRetryDelay(0, 1_000, 10_000)).toThrow();
    expect(() => calculateOutboxRetryDelay(1, 10_000, 1_000)).toThrow();
  });
});
