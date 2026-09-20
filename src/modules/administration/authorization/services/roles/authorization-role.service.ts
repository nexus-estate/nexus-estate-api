import { Injectable } from '@nestjs/common';

import type {
  AuthorizationRoleDetail,
  AuthorizationRoleListResult,
} from '../../types/contracts/authorization-role.contract';
import type { AuthorizationRoleListQueryDto } from '../../dto/authorization-management.dto';
import type { AuthorizationContextInput } from '../../context/authorization-context';
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';

@Injectable()
/** Stateless role query service operating on explicit authorization contexts. */
export class AuthorizationRoleService {
  constructor(private readonly repository: AuthorizationRoleRepository) {}

  /**
   * Lists roles for a platform context.
   *
   * @param context Platform context or legacy platform input.
   * @param query Role filters and pagination options.
   * @returns Paginated role summaries.
   */
  list(
    context: AuthorizationContextInput,
    query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    return this.repository.list(context, query);
  }

  /**
   * Loads one role and its permissions.
   *
   * @param context Platform context or legacy platform input.
   * @param roleId Role identifier.
   * @returns Role detail with permission summaries.
   */
  get(
    context: AuthorizationContextInput,
    roleId: string,
  ): Promise<AuthorizationRoleDetail> {
    return this.repository.findById(context, roleId);
  }
}
