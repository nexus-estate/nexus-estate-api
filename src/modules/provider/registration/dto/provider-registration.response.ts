import { ApiProperty } from '@nestjs/swagger';

import { ProviderAccountResponse } from '../../account/dto/provider-account.response';

/** Public result returned after a customer and provider account are created. */
export class ProviderRegistrationResponse {
  /** Customer account identifier used for subsequent authentication. */
  @ApiProperty({ format: 'uuid' })
  customerId: string;

  /** @deprecated Compatibility field; provider capability is stateful. */
  @ApiProperty({ example: 'customer' })
  role: string;

  /** Provider account remains unverified until an administrator reviews it. */
  @ApiProperty({ type: () => ProviderAccountResponse })
  providerAccount: ProviderAccountResponse;
}
