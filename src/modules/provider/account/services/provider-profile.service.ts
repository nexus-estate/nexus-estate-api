import { Injectable } from '@nestjs/common';

import { ProviderAccountService } from './provider-account.service';
import type { ProviderAccountResponse } from '../dto/provider-account.response';

/** Application service for the authenticated provider profile endpoint. */
@Injectable()
export class ProviderProfileService {
  constructor(
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  /** Returns the provider account owned by the authenticated customer. */
  getCurrent(customerId: string): Promise<ProviderAccountResponse> {
    return this.providerAccountService.getCurrent(customerId);
  }
}
