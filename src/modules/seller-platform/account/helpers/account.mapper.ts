import { SellerAccountResponse } from '../dto/account.response';
import { SellerAccount } from '../models/account.entity';

export class SellerAccountMapper {
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
