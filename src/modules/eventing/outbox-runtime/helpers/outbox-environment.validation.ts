const DEFAULTS = {
  OUTBOX_BATCH_SIZE: 25,
  OUTBOX_POLL_INTERVAL_MS: 1_000,
  OUTBOX_LEASE_MS: 60_000,
  OUTBOX_RETRY_BASE_MS: 1_000,
  OUTBOX_RETRY_MAX_MS: 300_000,
  OUTBOX_PUBLISH_TIMEOUT_MS: 30_000,
  OUTBOX_DRAIN_TIMEOUT_MS: 35_000,
  OUTBOX_HEALTH_PORT: 9_091,
};

/** Validates Kafka and delivery settings only in the separate outbox process. */
export function validateOutboxEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = text(raw.NODE_ENV || 'development');
  if (!['development', 'test', 'staging', 'production'].includes(nodeEnv)) {
    throw new Error(
      'NODE_ENV must be development, test, staging, or production',
    );
  }
  const databaseHost = requiredText(raw, 'DB_POSTGRES_HOST');
  const databaseUser = requiredText(raw, 'DB_POSTGRES_USER');
  const databasePassword = requiredText(raw, 'DB_POSTGRES_PASS');
  const databaseName = requiredText(raw, 'DB_POSTGRES_NAME');
  const databasePort = parseRawInteger(
    raw.DB_POSTGRES_PORT ?? 5432,
    'DB_POSTGRES_PORT',
    1,
    65_535,
  );
  const brokersText = requiredText(raw, 'KAFKA_BROKERS');
  const brokers = brokersText.split(',').map((broker) => broker.trim());
  if (!brokers.length || brokers.some((broker) => !isBrokerAddress(broker))) {
    throw new Error('KAFKA_BROKERS must be a comma-separated host:port list');
  }

  const clientId = requiredText(raw, 'KAFKA_CLIENT_ID');
  if (clientId.length > 128) {
    throw new Error('KAFKA_CLIENT_ID must be at most 128 characters');
  }

  const topic = requiredText(raw, 'KAFKA_TOPIC_MARKETPLACE_LISTING');
  if (
    topic.length > 249 ||
    topic === '.' ||
    topic === '..' ||
    !/^[a-zA-Z0-9._-]+$/.test(topic)
  ) {
    throw new Error(
      'KAFKA_TOPIC_MARKETPLACE_LISTING is not a valid topic name',
    );
  }

  const securityProtocol = text(
    raw.KAFKA_SECURITY_PROTOCOL || 'plaintext',
  ).toLowerCase();
  if (
    !['plaintext', 'ssl', 'sasl_plaintext', 'sasl_ssl'].includes(
      securityProtocol,
    )
  ) {
    throw new Error(
      'KAFKA_SECURITY_PROTOCOL must be plaintext, ssl, sasl_plaintext, or sasl_ssl',
    );
  }
  const saslRequired = securityProtocol.startsWith('sasl_');
  const saslMechanism = text(raw.KAFKA_SASL_MECHANISM || '').toUpperCase();
  const saslUsername = text(raw.KAFKA_SASL_USERNAME || '');
  const saslPassword = text(raw.KAFKA_SASL_PASSWORD || '');
  if (saslRequired) {
    if (!['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'].includes(saslMechanism)) {
      throw new Error('KAFKA_SASL_MECHANISM is required for SASL Kafka');
    }
    if (!saslUsername || !saslPassword) {
      throw new Error(
        'KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD are required for SASL Kafka',
      );
    }
  } else if (saslMechanism || saslUsername || saslPassword) {
    throw new Error('KAFKA_SASL_* settings require a SASL security protocol');
  }

  const config = {
    ...raw,
    NODE_ENV: nodeEnv,
    DB_POSTGRES_HOST: databaseHost,
    DB_POSTGRES_PORT: databasePort,
    DB_POSTGRES_USER: databaseUser,
    DB_POSTGRES_PASS: databasePassword,
    DB_POSTGRES_NAME: databaseName,
    KAFKA_BROKERS: brokers,
    KAFKA_CLIENT_ID: clientId,
    KAFKA_TOPIC_MARKETPLACE_LISTING: topic,
    KAFKA_SECURITY_PROTOCOL: securityProtocol,
    KAFKA_SASL_MECHANISM: saslMechanism || undefined,
    KAFKA_SASL_USERNAME: saslUsername || undefined,
    KAFKA_SASL_PASSWORD: saslPassword || undefined,
    OUTBOX_BATCH_SIZE: parseInteger(raw, 'OUTBOX_BATCH_SIZE', 1, 64),
    OUTBOX_POLL_INTERVAL_MS: parseInteger(
      raw,
      'OUTBOX_POLL_INTERVAL_MS',
      50,
      60_000,
    ),
    OUTBOX_LEASE_MS: parseInteger(raw, 'OUTBOX_LEASE_MS', 1_000, 3_600_000),
    OUTBOX_RETRY_BASE_MS: parseInteger(
      raw,
      'OUTBOX_RETRY_BASE_MS',
      1,
      86_400_000,
    ),
    OUTBOX_RETRY_MAX_MS: parseInteger(
      raw,
      'OUTBOX_RETRY_MAX_MS',
      1,
      86_400_000,
    ),
    OUTBOX_PUBLISH_TIMEOUT_MS: parseInteger(
      raw,
      'OUTBOX_PUBLISH_TIMEOUT_MS',
      1_000,
      300_000,
    ),
    OUTBOX_DRAIN_TIMEOUT_MS: parseInteger(
      raw,
      'OUTBOX_DRAIN_TIMEOUT_MS',
      1_000,
      600_000,
    ),
    OUTBOX_HEALTH_PORT: parseInteger(raw, 'OUTBOX_HEALTH_PORT', 1, 65_535),
  };

  if (config.OUTBOX_RETRY_MAX_MS < config.OUTBOX_RETRY_BASE_MS) {
    throw new Error(
      'OUTBOX_RETRY_MAX_MS must be at least OUTBOX_RETRY_BASE_MS',
    );
  }
  if (config.OUTBOX_LEASE_MS <= config.OUTBOX_PUBLISH_TIMEOUT_MS) {
    throw new Error('OUTBOX_LEASE_MS must exceed OUTBOX_PUBLISH_TIMEOUT_MS');
  }
  if (config.OUTBOX_DRAIN_TIMEOUT_MS < config.OUTBOX_PUBLISH_TIMEOUT_MS) {
    throw new Error(
      'OUTBOX_DRAIN_TIMEOUT_MS must be at least OUTBOX_PUBLISH_TIMEOUT_MS',
    );
  }

  return config;
}

function parseInteger(
  raw: Record<string, unknown>,
  key: keyof typeof DEFAULTS,
  minimum: number,
  maximum: number,
): number {
  const value =
    raw[key] === undefined
      ? DEFAULTS[key]
      : parseRawInteger(raw[key], key, minimum, maximum);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function parseRawInteger(
  raw: unknown,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function requiredText(raw: Record<string, unknown>, key: string): string {
  const value = text(raw[key]).trim();
  if (!value) throw new Error(`${key} is required by the outbox runtime`);
  return value;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isBrokerAddress(value: string): boolean {
  const match = /^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\]):([1-9][0-9]{0,4})$/.exec(
    value,
  );
  return Boolean(match && Number(match[1]) <= 65_535);
}
