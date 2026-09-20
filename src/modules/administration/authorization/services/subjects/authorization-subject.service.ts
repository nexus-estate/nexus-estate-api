import { Injectable } from '@nestjs/common';

import type {
  AuthorizationSubjectDetail as SubjectDetail,
  AuthorizationSubjectListResult,
} from '../../types/contracts/authorization-subject.contract';
import type { AuthorizationSubjectListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationSubjectRepository } from '../../repositories/subjects/authorization-subject.repository';

@Injectable()
export class AuthorizationSubjectService {
  constructor(private readonly repository: AuthorizationSubjectRepository) {}

  list(
    platform: AuthorizationPlatform,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationSubjectListResult> {
    return this.repository.list(platform, query);
  }

  get(
    platform: AuthorizationPlatform,
    subjectId: string,
  ): Promise<SubjectDetail> {
    return this.repository.findById(platform, subjectId);
  }
}
