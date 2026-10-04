import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';
import { OutboxDeliveryRepo } from '../../outbox/repositories/outbox-delivery.repo';
import type { ClaimedOutboxEvent } from '../../outbox/types/claimed-outbox-event';
import { calculateOutboxRetryDelay } from '../helpers/outbox-retry';
import { OutboxMetricsService } from './outbox-metrics.service';
import { EVENT_PUBLISHER, type EventPublisher } from '../types/event-publisher';

/** Ships claimed persisted envelopes with durable retry and bounded shutdown. */
@Injectable()
export class OutboxDispatcherService implements OnApplicationShutdown {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly instanceId: string;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly leaseMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly drainTimeoutMs: number;
  private readonly topic: string;
  private readonly saslPassword: string | undefined;
  private stopping = false;
  private initialized = false;
  private loopPromise: Promise<void> | undefined;

  constructor(
    private readonly deliveryRepo: OutboxDeliveryRepo,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    private readonly metrics: OutboxMetricsService,
    config: ConfigService,
  ) {
    this.instanceId =
      config.get<string>('OUTBOX_INSTANCE_ID')?.trim() ||
      `${hostname()}-${randomUUID()}`;
    if (this.instanceId.length > 128) {
      throw new Error('OUTBOX_INSTANCE_ID must be at most 128 characters');
    }
    this.batchSize = config.getOrThrow<number>('OUTBOX_BATCH_SIZE');
    this.pollIntervalMs = config.getOrThrow<number>('OUTBOX_POLL_INTERVAL_MS');
    this.leaseMs = config.getOrThrow<number>('OUTBOX_LEASE_MS');
    this.retryBaseMs = config.getOrThrow<number>('OUTBOX_RETRY_BASE_MS');
    this.retryMaxMs = config.getOrThrow<number>('OUTBOX_RETRY_MAX_MS');
    this.drainTimeoutMs = config.getOrThrow<number>('OUTBOX_DRAIN_TIMEOUT_MS');
    this.topic = config.getOrThrow<string>('KAFKA_TOPIC_MARKETPLACE_LISTING');
    this.saslPassword = config.get<string>('KAFKA_SASL_PASSWORD');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /** Starts polling even when Kafka is down; committed work stays in PostgreSQL. */
  async start(): Promise<void> {
    if (this.loopPromise) return;
    this.initialized = true;
    await this.ensureKafkaConnection();
    this.loopPromise = this.runLoop();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    const loop = this.loopPromise;
    if (loop) {
      let timeout: NodeJS.Timeout | undefined;
      const completed = await Promise.race([
        loop.then(() => true),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), this.drainTimeoutMs);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      if (!completed) {
        this.logger.error(
          JSON.stringify({
            runtime: 'outbox',
            result: 'drain_timeout',
            drain_timeout_ms: this.drainTimeoutMs,
          }),
        );
      }
    }
    try {
      await this.publisher.disconnect();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          runtime: 'outbox',
          result: 'kafka_disconnect_failed',
          error_code: errorCode(error),
          error_message: sanitizeErrorMessage(error, this.saslPassword),
        }),
      );
    }
    this.initialized = false;
  }

  private async runLoop(): Promise<void> {
    while (!this.stopping) {
      if (!this.publisher.isConnected()) {
        await this.ensureKafkaConnection();
        if (!this.publisher.isConnected()) {
          await delay(this.pollIntervalMs);
          continue;
        }
      }

      let claimed: ClaimedOutboxEvent[];
      try {
        claimed = await this.deliveryRepo.claimBatch(
          this.instanceId,
          this.batchSize,
          this.leaseMs,
        );
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            runtime: 'outbox',
            result: 'claim_failed',
            error_code: errorCode(error),
            error_message: sanitizeErrorMessage(error, this.saslPassword),
          }),
        );
        await delay(this.pollIntervalMs);
        continue;
      }

      if (claimed.length === 0) {
        await delay(this.pollIntervalMs);
        continue;
      }

      const expiredCount = claimed.filter((event) => event.leaseExpired).length;
      this.metrics.claimed(claimed.length, expiredCount);
      await Promise.allSettled(claimed.map((event) => this.dispatchOne(event)));
    }
  }

  private async ensureKafkaConnection(): Promise<void> {
    try {
      await this.publisher.connect();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          runtime: 'outbox',
          result: 'kafka_connect_failed',
          error_code: errorCode(error),
          error_message: sanitizeErrorMessage(error, this.saslPassword),
        }),
      );
    }
  }

  private async dispatchOne(
    claimed: Awaited<ReturnType<OutboxDeliveryRepo['claimBatch']>>[number],
  ): Promise<void> {
    const { envelope, attemptCount } = claimed;
    const startedAt = performance.now();
    try {
      await this.publisher.publish(envelope);
    } catch (error) {
      const durationMs = Math.max(0, performance.now() - startedAt);
      this.metrics.failed(durationMs);
      const code = errorCode(error);
      const message = sanitizeErrorMessage(error, this.saslPassword);
      const retryDelayMs = calculateOutboxRetryDelay(
        attemptCount,
        this.retryBaseMs,
        this.retryMaxMs,
      );
      try {
        const scheduled = await this.deliveryRepo.scheduleRetry(
          envelope.eventId,
          this.instanceId,
          retryDelayMs,
          code,
          message,
        );
        this.logEvent(envelope, attemptCount, durationMs, {
          result: scheduled ? 'retry_scheduled' : 'lease_lost_after_failure',
          error_code: code,
          error_message: message,
          retry_delay_ms: retryDelayMs,
        });
      } catch (retryError) {
        this.logger.error(
          JSON.stringify({
            ...eventFields(envelope, attemptCount, this.instanceId),
            result: 'retry_persistence_failed',
            error_code: errorCode(retryError),
            error_message: sanitizeErrorMessage(retryError, this.saslPassword),
          }),
        );
      }
      return;
    }

    const durationMs = Math.max(0, performance.now() - startedAt);
    let marked: boolean;
    try {
      marked = await this.deliveryRepo.markDelivered(
        envelope.eventId,
        this.instanceId,
      );
    } catch (error) {
      this.metrics.acknowledgedWithoutDeliveryMark(durationMs);
      this.logger.error(
        JSON.stringify({
          ...eventFields(envelope, attemptCount, this.instanceId),
          result: 'delivery_mark_failed_after_ack',
          duration_ms: Math.round(durationMs),
          error_code: errorCode(error),
          error_message: sanitizeErrorMessage(error, this.saslPassword),
        }),
      );
      return;
    }
    if (marked) {
      this.metrics.delivered(durationMs);
      this.logEvent(envelope, attemptCount, durationMs, {
        result: 'delivered',
      });
      return;
    }

    this.metrics.acknowledgedWithoutDeliveryMark(durationMs);
    this.logEvent(envelope, attemptCount, durationMs, {
      result: 'lease_lost_after_ack',
    });
  }

  private logEvent(
    envelope: {
      eventId: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      revision: string;
    },
    attemptCount: number,
    durationMs: number,
    fields: Record<string, string | number>,
  ): void {
    this.logger.log(
      JSON.stringify({
        ...eventFields(envelope, attemptCount, this.instanceId),
        topic: this.topic,
        duration_ms: Math.round(durationMs),
        ...fields,
      }),
    );
  }
}

function eventFields(
  envelope: {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    revision: string;
  },
  attemptCount: number,
  leaseOwner: string,
): Record<string, string | number> {
  return {
    event_id: envelope.eventId,
    event_type: envelope.eventType,
    aggregate_type: envelope.aggregateType,
    aggregate_id: envelope.aggregateId,
    revision: envelope.revision,
    attempt_count: attemptCount,
    lease_owner: leaseOwner,
  };
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const code = (error as Error & { code?: unknown }).code;
  const value = typeof code === 'string' ? code : error.name;
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 128) || 'UNKNOWN';
}

function sanitizeErrorMessage(error: unknown, secret?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  let sanitized = raw
    .replace(/:\/\/([^:/@\s]+):([^@\s]+)@/g, '://[REDACTED]@')
    .replace(
      /(password|passwd|secret|token)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    );
  if (secret) sanitized = sanitized.split(secret).join('[REDACTED]');
  return sanitized.slice(0, 1_024);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
