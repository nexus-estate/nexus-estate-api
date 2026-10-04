import { validateOutboxEnvironment } from './outbox-environment.validation';

const base = {
  NODE_ENV: 'production',
  DB_POSTGRES_HOST: 'postgres',
  DB_POSTGRES_PORT: '5432',
  DB_POSTGRES_USER: 'nexus',
  DB_POSTGRES_PASS: 'runtime-secret',
  DB_POSTGRES_NAME: 'nexus_estate',
  KAFKA_BROKERS: 'kafka-1:9092, kafka-2:9092',
  KAFKA_CLIENT_ID: 'nexus-outbox',
  KAFKA_TOPIC_MARKETPLACE_LISTING: 'nexus.marketplace.listing.v1',
};

describe('validateOutboxEnvironment', () => {
  it('requires database and Kafka settings without requiring HTTP or JWT settings', () => {
    const config = validateOutboxEnvironment(base);
    expect(config).toMatchObject({
      KAFKA_BROKERS: ['kafka-1:9092', 'kafka-2:9092'],
      KAFKA_SECURITY_PROTOCOL: 'plaintext',
      OUTBOX_BATCH_SIZE: 25,
      OUTBOX_HEALTH_PORT: 9_091,
    });
    expect(() =>
      validateOutboxEnvironment({ ...base, KAFKA_BROKERS: undefined }),
    ).toThrow('KAFKA_BROKERS is required');
  });

  it('validates SASL credentials and retry/lease bounds', () => {
    expect(() =>
      validateOutboxEnvironment({
        ...base,
        KAFKA_SECURITY_PROTOCOL: 'sasl_ssl',
      }),
    ).toThrow('KAFKA_SASL_MECHANISM is required');

    const config = validateOutboxEnvironment({
      ...base,
      KAFKA_SECURITY_PROTOCOL: 'sasl_ssl',
      KAFKA_SASL_MECHANISM: 'scram-sha-512',
      KAFKA_SASL_USERNAME: 'publisher',
      KAFKA_SASL_PASSWORD: 'provided-by-runtime-secret',
    });
    expect(config).toMatchObject({
      KAFKA_SASL_MECHANISM: 'SCRAM-SHA-512',
      OUTBOX_RETRY_BASE_MS: 1_000,
    });

    expect(() =>
      validateOutboxEnvironment({
        ...base,
        OUTBOX_RETRY_BASE_MS: '5000',
        OUTBOX_RETRY_MAX_MS: '1000',
      }),
    ).toThrow('OUTBOX_RETRY_MAX_MS must be at least');
    expect(() =>
      validateOutboxEnvironment({ ...base, OUTBOX_LEASE_MS: '30000' }),
    ).toThrow('OUTBOX_LEASE_MS must exceed');
  });

  it('rejects malformed broker and topic values', () => {
    expect(() =>
      validateOutboxEnvironment({ ...base, KAFKA_BROKERS: 'broker:70000' }),
    ).toThrow('KAFKA_BROKERS');
    expect(() =>
      validateOutboxEnvironment({
        ...base,
        KAFKA_TOPIC_MARKETPLACE_LISTING: 'bad/topic',
      }),
    ).toThrow('KAFKA_TOPIC_MARKETPLACE_LISTING');
  });
});
