import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Provides the only password hashing boundary used by application logic.
 * Keeping bcrypt behind this service makes cost-factor changes and testing
 * decisions explicit without leaking a library detail into domain services.
 */
@Injectable()
/** Encapsulates password hashing and comparison so credential handling stays consistent. */
export class BcryptService {
  private readonly saltRounds: number;

  constructor() {
    const configuredRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    this.saltRounds =
      Number.isInteger(configuredRounds) && configuredRounds > 0
        ? configuredRounds
        : 10;
  }

  /** Hashes a plaintext secret with the configured bcrypt cost factor. */
  /** Hashes a secret using the configured adaptive password algorithm. */
  hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  /** Compares a plaintext secret with a bcrypt digest. */
  /** Compares a candidate secret to a stored digest without exposing hash details. */
  compare(value: string, digest: string): Promise<boolean> {
    return bcrypt.compare(value, digest);
  }
}
