import { Injectable } from '@nestjs/common';

import type { AuthorizationProviderMemberListResult } from '../../types/contracts/authorization-management.contract';
import type { AuthorizationSubjectListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationManagementCoreService } from '../authorization-management.service';

@Injectable()
export class AuthorizationProviderMembershipService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  list(
    providerId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationProviderMemberListResult> {
    return this.core.providerMembers(providerId, query);
  }
}
