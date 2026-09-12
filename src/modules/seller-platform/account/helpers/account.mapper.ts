import { SellerAccountResponse } from '../dto/account.response';
import { SellerAccount } from '../models/account.entity';

/** Converts persistence entities into the public seller-account response shape. */
export class SellerAccountMapper {
  /** Omits owner and audit internals from the API response. */
  static toResponse(account: SellerAccount): SellerAccountResponse {
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
