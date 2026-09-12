import { ApiProperty } from '@nestjs/swagger';

import { ProviderAccountResponse } from '../../../provider/account/dto/provider-account.response';

/** Minimal customer information an administrator needs to review a request. */
export class ProviderRegistrationOwnerResponse {
  /** Customer account identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Customer login email. */
  @ApiProperty({ format: 'email' })
  email: string;

  /** Whether the customer has verified their email address. */
  @ApiProperty()
  isEmailVerified: boolean;

  /** @deprecated Computed compatibility field; customer context is implicit. */
  @ApiProperty({ example: 'customer' })
  role: string;

  /** Last successful login, if the customer has logged in before. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLogin: Date | null;

  /** Customer account creation timestamp. */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /** Customer account last update timestamp. */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

/** Administrator review view for a pending provider-registration request. */
export class ProviderRegistrationReviewResponse {
  /** Provider-account request identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Customer who submitted or owns the request. */
  @ApiProperty({ type: () => ProviderRegistrationOwnerResponse })
  owner: ProviderRegistrationOwnerResponse;

  /** Provider-account data submitted for review. */
  @ApiProperty({ type: () => ProviderAccountResponse })
  providerAccount: ProviderAccountResponse;
}
