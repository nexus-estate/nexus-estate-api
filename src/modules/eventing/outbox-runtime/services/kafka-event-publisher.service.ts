import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';
import { toMarketplaceKafkaRecord } from '../helpers/marketplace-event-routing';
import type { EventPublisher } from '../types/event-publisher';

/** Sends the exact persisted Listing envelope and awaits an all-replica ACK. */
@Injectable()
export class KafkaEventPublisher implements EventPublisher {
  private readonly kafka: KafkaJS.Kafka;
  private readonly producerConfig: KafkaJS.ProducerConstructorConfig;
  private producer: ReturnType<KafkaJS.Kafka['producer']> | undefined;
  private producerNeedsDisconnect = false;
  private readonly topic: string;
  private connected = false;
  private connectPromise: Promise<void> | undefined;

  constructor(private readonly config: ConfigService) {
    this.topic = config.getOrThrow<string>('KAFKA_TOPIC_MARKETPLACE_LISTING');
    const timeoutMs = config.getOrThrow<number>('OUTBOX_PUBLISH_TIMEOUT_MS');
    const securityProtocol = config.getOrThrow<string>(
      'KAFKA_SECURITY_PROTOCOL',
    );
    const usesTls =
      securityProtocol === 'ssl' || securityProtocol === 'sasl_ssl';
    const sslCaLocation = config.get<string>('KAFKA_SSL_CA_LOCATION')?.trim();
    if (usesTls && !sslCaLocation) {
      throw new Error(
        'KAFKA_SSL_CA_LOCATION is required for ssl and sasl_ssl Kafka protocols',
      );
    }
    this.kafka = new KafkaJS.Kafka();
    this.producerConfig = {
      'bootstrap.servers': config
        .getOrThrow<string[]>('KAFKA_BROKERS')
        .join(','),
      'client.id': config.getOrThrow<string>('KAFKA_CLIENT_ID'),
      'security.protocol': securityProtocol as
        'plaintext' | 'ssl' | 'sasl_plaintext' | 'sasl_ssl',
      ...(usesTls && sslCaLocation ? { 'ssl.ca.location': sslCaLocation } : {}),
      ...(securityProtocol.startsWith('sasl_')
        ? {
            'sasl.mechanism': config.getOrThrow<string>('KAFKA_SASL_MECHANISM'),
            'sasl.username': config.getOrThrow<string>('KAFKA_SASL_USERNAME'),
            'sasl.password': config.getOrThrow<string>('KAFKA_SASL_PASSWORD'),
          }
        : {}),
      'enable.idempotence': true,
      'message.send.max.retries': 5,
      'retry.backoff.ms': 250,
      'request.required.acks': -1,
      'request.timeout.ms': timeoutMs,
      'socket.timeout.ms': timeoutMs,
      'socket.connection.setup.timeout.ms': timeoutMs,
      'message.timeout.ms': timeoutMs,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Recreates the one-shot Confluent producer after connection/send failure. */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    const connection = this.connectWithFreshProducer();
    this.connectPromise = connection;
    try {
      await connection;
    } finally {
      if (this.connectPromise === connection) this.connectPromise = undefined;
    }
  }

  async publish(event: EventEnvelope<unknown>): Promise<void> {
    const producer = this.producer;
    if (!this.connected || !producer) {
      throw new Error('Kafka producer is not connected');
    }

    const record = toMarketplaceKafkaRecord(this.topic, event);
    try {
      const reports = await producer.send({
        topic: record.topic,
        messages: [{ key: record.key, value: record.value }],
      });
      const failedReport = reports.find((report) => report.errorCode !== 0);
      if (failedReport) {
        throw new Error(
          `Kafka delivery failed with code ${failedReport.errorCode}`,
        );
      }
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.connectPromise?.catch(() => undefined);
    this.connected = false;
    await this.disconnectCurrentProducer();
  }

  private async connectWithFreshProducer(): Promise<void> {
    try {
      await this.disconnectCurrentProducer();
    } catch {
      // Replace a failed client; the next producer owns subsequent retries.
    }

    const producer = this.kafka.producer(this.producerConfig);
    this.producer = producer;
    this.producerNeedsDisconnect = true;
    try {
      await producer.connect();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      try {
        await this.disconnectCurrentProducer();
      } catch {
        // Durable outbox retry owns recovery while the broker is unavailable.
      }
      throw error;
    }
  }

  private async disconnectCurrentProducer(): Promise<void> {
    const producer = this.producer;
    if (!producer || !this.producerNeedsDisconnect) return;
    this.producerNeedsDisconnect = false;
    await producer.disconnect();
  }
}
