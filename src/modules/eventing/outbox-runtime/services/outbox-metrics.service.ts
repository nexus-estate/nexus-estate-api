import { Injectable } from '@nestjs/common';
import type { OutboxBacklogStats } from '../../outbox/repositories/outbox-delivery.repo';

const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 5_000];

/** Holds process metrics while reading pending age/count from PostgreSQL. */
@Injectable()
export class OutboxMetricsService {
  private claimedTotal = 0;
  private deliveredTotal = 0;
  private retryTotal = 0;
  private publishFailureTotal = 0;
  private leaseExpiredTotal = 0;
  private publishCount = 0;
  private publishDurationSumMs = 0;
  private readonly publishDurationBuckets = new Map<number, number>(
    DURATION_BUCKETS_MS.map((bucket) => [bucket, 0]),
  );

  claimed(count: number, expiredCount: number): void {
    this.claimedTotal += count;
    this.leaseExpiredTotal += expiredCount;
  }

  delivered(durationMs: number): void {
    this.deliveredTotal += 1;
    this.observePublishDuration(durationMs);
  }

  failed(durationMs: number): void {
    this.retryTotal += 1;
    this.publishFailureTotal += 1;
    this.observePublishDuration(durationMs);
  }

  acknowledgedWithoutDeliveryMark(durationMs: number): void {
    this.observePublishDuration(durationMs);
  }

  async render(backlog: () => Promise<OutboxBacklogStats>): Promise<string> {
    const stats = await backlog();
    const lines = [
      '# HELP outbox_pending_total Undelivered events in PostgreSQL.',
      '# TYPE outbox_pending_total gauge',
      `outbox_pending_total ${stats.pendingTotal}`,
      '# HELP outbox_oldest_pending_age_seconds Age of the oldest undelivered event.',
      '# TYPE outbox_oldest_pending_age_seconds gauge',
      `outbox_oldest_pending_age_seconds ${stats.oldestPendingAgeSeconds}`,
      '# TYPE outbox_claimed_total counter',
      `outbox_claimed_total ${this.claimedTotal}`,
      '# TYPE outbox_delivered_total counter',
      `outbox_delivered_total ${this.deliveredTotal}`,
      '# TYPE outbox_retry_total counter',
      `outbox_retry_total ${this.retryTotal}`,
      '# TYPE outbox_publish_failure_total counter',
      `outbox_publish_failure_total ${this.publishFailureTotal}`,
      '# TYPE outbox_lease_expired_total counter',
      `outbox_lease_expired_total ${this.leaseExpiredTotal}`,
      '# TYPE outbox_publish_duration_seconds histogram',
    ];
    for (const bucket of DURATION_BUCKETS_MS) {
      lines.push(
        `outbox_publish_duration_seconds_bucket{le="${bucket / 1_000}"} ${this.publishDurationBuckets.get(bucket)}`,
      );
    }
    lines.push(
      `outbox_publish_duration_seconds_bucket{le="+Inf"} ${this.publishCount}`,
      `outbox_publish_duration_seconds_sum ${this.publishDurationSumMs / 1_000}`,
      `outbox_publish_duration_seconds_count ${this.publishCount}`,
    );
    return `${lines.join('\n')}\n`;
  }

  private observePublishDuration(durationMs: number): void {
    this.publishCount += 1;
    this.publishDurationSumMs += durationMs;
    for (const bucket of DURATION_BUCKETS_MS) {
      if (durationMs <= bucket) {
        this.publishDurationBuckets.set(
          bucket,
          (this.publishDurationBuckets.get(bucket) ?? 0) + 1,
        );
      }
    }
  }
}
