import { ApiProperty } from '@nestjs/swagger';

import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

/** Public representation of a provider account returned by the API. */
export class ProviderAccountResponse {
  /** Stable provider-account identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Account operating model. */
  @ApiProperty({ enum: ProviderType })
  type: ProviderType;

  /** Marketplace-facing display name. */
  @ApiProperty()
  displayName: string;

  /** Current lifecycle state. */
  @ApiProperty({ enum: ProviderStatus, enumName: 'ProviderStatus' })
  status: ProviderStatus;

  /** Current verification state. */
  @ApiProperty({
    enum: ProviderVerificationStatus,
    enumName: 'ProviderVerificationStatus',
  })
  verificationStatus: ProviderVerificationStatus;

  /** Creation timestamp inherited from BaseEntity. */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /** Last update timestamp inherited from BaseEntity. */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

/** @deprecated Use ProviderAccountResponse in new code. */
