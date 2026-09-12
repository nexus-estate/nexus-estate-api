import { ApiProperty } from '@nestjs/swagger';

import { ProviderAccountResponse } from './provider-account.response';

/** Public result returned after a customer and provider account are created. */
export class ProviderRegistrationResponse {
  /** Customer account identifier used for subsequent authentication. */
  @ApiProperty({ format: 'uuid' })
  customerId: string;

  /** Persisted role assigned to provider API access. */
  @ApiProperty({ example: 'provider' })
  role: string;

  /** Provider account remains unverified until an administrator reviews it. */
  @ApiProperty({ type: () => ProviderAccountResponse })
  providerAccount: ProviderAccountResponse;
}
