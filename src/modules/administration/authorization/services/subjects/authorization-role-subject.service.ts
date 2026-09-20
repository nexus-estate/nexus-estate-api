import { Injectable } from '@nestjs/common';

import type { AuthorizationRoleSubjectsResult } from '../../types/contracts/authorization-role.contract';
import type { AuthorizationSubjectDetail } from '../../types/contracts/authorization-subject.contract';
import type {
  AuthorizationSubjectListQueryDto,
  ReplaceSubjectRolesDto,
} from '../../dto/authorization-management.dto';
import {
  authorizationContext,
  type AuthorizationContextInput,
} from '../../context/authorization-context';
import { AuthorizationManagementCoreService } from '../authorization-management.service';
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';
import { AuthorizationSubjectRepository } from '../../repositories/subjects/authorization-subject.repository';

@Injectable()
/** Coordinates subject-role reads and mutations for one authorization context. */
export class AuthorizationRoleSubjectService {
  constructor(
    private readonly core: AuthorizationManagementCoreService,
    private readonly roleRepository: AuthorizationRoleRepository,
    private readonly subjectRepository: AuthorizationSubjectRepository,
  ) {}

  /**
   * Lists subjects assigned to a role.
   *
   * The result preserves the public `{ role, items, meta }` contract.
   */
  async listForRole(
    context: AuthorizationContextInput,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    const [role, subjects] = await Promise.all([
      this.roleRepository.findById(context, roleId),
      this.subjectRepository.list(context, query, roleId),
    ]);
    return { role, ...subjects };
  }

  /** Replaces all roles assigned to a subject and returns updated detail. */
  async replaceRoles(
    context: AuthorizationContextInput,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationSubjectDetail> {
    const resolvedContext = authorizationContext(context);
    const updatedSubjectId = await this.core.replaceSubjectRoles(
      resolvedContext,
      subjectId,
      dto,
      actor,
      requestId,
    );
    return await this.subjectRepository.findById(context, updatedSubjectId);
  }
}
