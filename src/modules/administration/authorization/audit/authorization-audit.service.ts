import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AuthorizationAuditRepository,
  type AuthorizationAuditEvent,
} from './authorization-audit.repository';

/** Audit orchestration boundary; callers pass the active mutation executor. */
@Injectable()
export class AuthorizationAuditService {
  constructor(private readonly repository: AuthorizationAuditRepository) {}

  record(
    manager: EntityManager | DataSource,
    event: AuthorizationAuditEvent,
  ): Promise<void> {
    return this.repository.append(manager, event);
  }
}
