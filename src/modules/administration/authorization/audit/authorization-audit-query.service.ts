import { Injectable } from '@nestjs/common';

import type { AuthorizationAuditResult } from '../types/contracts/authorization-management.contract';
import type { AuthorizationAuditQueryDto } from '../dto/authorization-management.dto';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';

@Injectable()
export class AuthorizationAuditQueryService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  search(query: AuthorizationAuditQueryDto): Promise<AuthorizationAuditResult> {
    return this.core.audit(query);
  }
}
