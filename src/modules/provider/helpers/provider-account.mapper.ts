import { ProviderAccountResponse } from '../dto/provider-account.response';
import { ProviderAccount } from '../models/provider-account.entity';

/** Converts persistence entities into the public provider-account response shape. */
export class ProviderAccountMapper {
  /** Omits owner and audit internals from the API response. */
  static toResponse(account: ProviderAccount): ProviderAccountResponse {
    return {
      id: account.id,
      type: account.type,
      displayName: account.displayName,
      status: account.status,
      verificationStatus: account.verificationStatus,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
