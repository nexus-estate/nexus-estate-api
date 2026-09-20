import { Injectable } from '@nestjs/common';

import type {
  AuthorizationSubjectDetail as SubjectDetail,
  AuthorizationSubjectListResult,
} from '../../types/contracts/authorization-subject.contract';
import type { AuthorizationSubjectListQueryDto } from '../../dto/authorization-management.dto';
import type { AuthorizationContextInput } from '../../context/authorization-context';
import { AuthorizationSubjectRepository } from '../../repositories/subjects/authorization-subject.repository';

@Injectable()
/** Stateless subject query service operating on explicit contexts. */
export class AuthorizationSubjectService {
  constructor(private readonly repository: AuthorizationSubjectRepository) {}

  /** Lists subjects using the selected platform's identity semantics. */
  list(
    context: AuthorizationContextInput,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationSubjectListResult> {
    return this.repository.list(context, query);
  }

  /** Loads one subject with assigned roles and effective permissions. */
  get(
    context: AuthorizationContextInput,
    subjectId: string,
  ): Promise<SubjectDetail> {
    return this.repository.findById(context, subjectId);
  }
}
