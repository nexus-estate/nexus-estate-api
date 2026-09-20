import type { AuthorizationContext } from '../context/authorization-context';
import type {
  AuthorizationSubjectListQueryDto,
  ReplaceSubjectRolesDto,
} from '../dto/authorization-management.dto';
import type { AuthorizationSubjectService } from '../services/subjects/authorization-subject.service';
import type { AuthorizationRoleSubjectService } from '../services/subjects/authorization-role-subject.service';
import type {
  AuthorizationSubjectDetail,
  AuthorizationSubjectListResult,
} from '../types/contracts/authorization-subject.contract';
import type { AuthorizationRoleSubjectsResult } from '../types/contracts/authorization-role.contract';

/** Platform-bound API for authorization subjects and role assignments. */
export class AuthorizationSubjectScope {
  constructor(
    private readonly context: AuthorizationContext,
    private readonly subjectService: AuthorizationSubjectService,
    private readonly roleSubjectService: AuthorizationRoleSubjectService,
  ) {}

  /** Lists subjects using the bound platform's identity semantics. */
  list(
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationSubjectListResult> {
    return this.subjectService.list(this.context, query);
  }

  /** Gets one subject with roles and effective permissions. */
  get(subjectId: string): Promise<AuthorizationSubjectDetail> {
    return this.subjectService.get(this.context, subjectId);
  }

  /** Lists subjects assigned to a role in the bound platform. */
  listForRole(
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    return this.roleSubjectService.listForRole(this.context, roleId, query);
  }

  /** Replaces all roles assigned to a subject atomically. */
  replaceRoles(
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationSubjectDetail> {
    return this.roleSubjectService.replaceRoles(
      this.context,
      subjectId,
      dto,
      actor,
      requestId,
    );
  }
}
