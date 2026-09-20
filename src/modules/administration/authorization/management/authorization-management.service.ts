import { Injectable } from '@nestjs/common';

import type { AuthorizationMatrixResult } from '../types/contracts/authorization-matrix.contract';
import type { AuthorizationPlatformsResult } from '../types/contracts/authorization-management.contract';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';

/** Provides the small set of cross-feature management operations still shared by the UI. */
@Injectable()
export class AuthorizationManagementService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  platforms(): AuthorizationPlatformsResult {
    return this.core.platforms();
  }

  matrix(platform: AuthorizationPlatform): Promise<AuthorizationMatrixResult> {
    return this.core.matrix(platform);
  }
}
