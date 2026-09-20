import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type { AuthorizationPlatform } from '../../enums/authorization-platform.enum';

export interface AuthorizationPlatformMetadata {
  platform: AuthorizationPlatform;
  displayName: string;
  subjectType: string;
  supportsRoles: true;
  supportsAssignments: true;
}

export interface AuthorizationPlatformsResult {
  items: AuthorizationPlatformMetadata[];
}

export interface AuthorizationAuditEventResult {
  id: string;
  actorAdministratorId: string;
  platform: AuthorizationPlatform;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: Date;
}

export type AuthorizationAuditResult =
  PaginatedResult<AuthorizationAuditEventResult>;

export interface AuthorizationProviderMemberSummary {
  id: string;
  providerId: string;
  customerId: string;
  status: string;
  joinedAt: Date;
  customerEmail: string;
  roleCodes: string[];
}

export type AuthorizationProviderMemberListResult =
  PaginatedResult<AuthorizationProviderMemberSummary>;
