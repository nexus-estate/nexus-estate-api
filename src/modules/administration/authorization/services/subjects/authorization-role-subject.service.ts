import { Injectable } from '@nestjs/common';

import type { AuthorizationRoleSubjectsResult } from '../../types/contracts/authorization-role.contract';
import type { AuthorizationSubjectDetail } from '../../types/contracts/authorization-subject.contract';
import type {
  AuthorizationSubjectListQueryDto,
  ReplaceSubjectRolesDto,
} from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../authorization-management.service';
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';
import { AuthorizationSubjectRepository } from '../../repositories/subjects/authorization-subject.repository';

@Injectable()
export class AuthorizationRoleSubjectService {
  constructor(
    private readonly core: AuthorizationManagementCoreService,
    private readonly roleRepository: AuthorizationRoleRepository,
    private readonly subjectRepository: AuthorizationSubjectRepository,
  ) {}

  listForRole(
    platform: AuthorizationPlatform,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    return Promise.all([
      this.roleRepository.findById(platform, roleId),
      this.subjectRepository.list(platform, query, roleId),
    ]).then(([role, subjects]) => ({ role, ...subjects }));
  }

  replaceRoles(
    platform: AuthorizationPlatform,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationSubjectDetail> {
    return this.core
      .replaceSubjectRoles(platform, subjectId, dto, actor, requestId)
      .then((updatedSubjectId) =>
        this.subjectRepository.findById(platform, updatedSubjectId),
      );
  }
}
