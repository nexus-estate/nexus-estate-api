import { Injectable } from '@nestjs/common';

import type { AuthorizationRoleSubjectsResult } from '../../types/contracts/authorization-role.contract';
import type { AuthorizationSubjectDetail } from '../../types/contracts/authorization-subject.contract';
import type {
  AuthorizationSubjectListQueryDto,
  ReplaceSubjectRolesDto,
} from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../authorization-management.service';

@Injectable()
export class AuthorizationRoleSubjectService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  listForRole(
    platform: AuthorizationPlatform,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    return this.core.roleSubjects(platform, roleId, query);
  }

  replaceRoles(
    platform: AuthorizationPlatform,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationSubjectDetail> {
    return this.core.replaceSubjectRoles(
      platform,
      subjectId,
      dto,
      actor,
      requestId,
    );
  }
}
