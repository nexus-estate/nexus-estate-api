import { SellerAccountResponse } from './dto/seller-account.response';
import { SellerAccount } from './entity';

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
