import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Provides the only password hashing boundary used by application logic.
 * Keeping bcrypt behind this service makes cost-factor changes and testing
 * decisions explicit without leaking a library detail into domain services.
 */
@Injectable()
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
  hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  /** Compares a plaintext secret with a bcrypt digest. */
  compare(value: string, digest: string): Promise<boolean> {
    return bcrypt.compare(value, digest);
  }
}
