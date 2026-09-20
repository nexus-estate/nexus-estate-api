import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AdministrationPrincipal } from '../../../../common/security/auth.types';
import { RequestWithContext } from '../../../../common/middleware/request-context.middleware';
import { AdministrationJwtAuthGuard } from '../../authentication/guards/administration-jwt-auth.guard';
import { AdministrationPermissionRequire } from '../decorators/administration-permission.decorator';
import { AdministrationPermissionsGuard } from '../guards/administration-permissions.guard';
import { ADMINISTRATION_PERMISSIONS } from '../constants/administration-permission.constant';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import {
  AuthorizationAuditQueryDto,
  AuthorizationPermissionListQueryDto,
  AuthorizationRoleListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';
import { AuthorizationManagementService } from '../management/authorization-management.service';
import { AuthorizationRoleService } from '../services/roles/authorization-role.service';
import { AuthorizationRoleCommandService } from '../services/roles/authorization-role-command.service';
import { AuthorizationPermissionService } from '../services/permissions/authorization-permission.service';
import { AuthorizationSubjectService } from '../services/subjects/authorization-subject.service';
import { AuthorizationRoleSubjectService } from '../services/subjects/authorization-role-subject.service';
import { AuthorizationAuditQueryService } from '../audit/authorization-audit-query.service';
import type {
  AuthorizationRoleDetail,
  AuthorizationRoleDeletionResult,
  AuthorizationRoleListResult,
  AuthorizationRoleSubjectsResult,
} from '../types/contracts/authorization-role.contract';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from '../types/contracts/authorization-permission.contract';
import type { AuthorizationSubjectDetail } from '../types/contracts/authorization-subject.contract';
import type { AuthorizationSubjectListResult } from '../types/contracts/authorization-role.contract';
import type { AuthorizationMatrixResult } from '../types/contracts/authorization-matrix.contract';
import type {
  AuthorizationAuditResult,
  AuthorizationPlatformsResult,
} from '../types/contracts/authorization-management.contract';

/** UI-ready Administration-only management API for all platform auth domains. */
@ApiTags('Administration Authorization')
@ApiBearerAuth()
@Controller('administration/authorization')
@UseGuards(AdministrationJwtAuthGuard, AdministrationPermissionsGuard)
export class AuthorizationManagementController {
  constructor(
    private readonly service: AuthorizationManagementService,
    private readonly roleService: AuthorizationRoleService,
    private readonly roleCommandService: AuthorizationRoleCommandService,
    private readonly permissionService: AuthorizationPermissionService,
    private readonly subjectService: AuthorizationSubjectService,
    private readonly roleSubjectService: AuthorizationRoleSubjectService,
    private readonly auditQueryService: AuthorizationAuditQueryService,
  ) {}

  /** Lists the platform domains available to administration management. */
  @Get('platforms')
  @ApiOperation({ summary: 'List authorization platforms' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PLATFORM_READ,
  )
  platforms(): AuthorizationPlatformsResult {
    return this.service.platforms();
  }

  /** Searches immutable audit history using bounded management filters. */
  @Get('audit')
  @ApiOperation({ summary: 'Search authorization audit events' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_AUDIT_READ,
  )
  audit(
    @Query() query: AuthorizationAuditQueryDto,
  ): Promise<AuthorizationAuditResult> {
    return this.auditQueryService.search(query);
  }

  /** Lists platform roles with counts and truthful allowed actions. */
  @Get(':platform/roles')
  @ApiOperation({ summary: 'List platform roles' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiOkResponse({
    description: 'Paginated role summaries with allowed actions.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  roles(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    return this.roleService.list(platform, query);
  }

  /** Creates one custom role in the selected platform. */
  @Post(':platform/roles')
  @ApiOperation({ summary: 'Create a custom platform role' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiCreatedResponse({ description: 'Created role and normalized metadata.' })
  @ApiBadRequestResponse({ description: 'Invalid role or request payload.' })
  @ApiConflictResponse({ description: 'AUTHORIZATION_ROLE_CODE_EXISTS.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  createRole(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Body() dto: CreateAuthorizationRoleDto,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ): Promise<AuthorizationRoleDetail> {
    return this.roleCommandService.create(
      platform,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  /** Returns one exact role and its current platform permissions. */
  @Get(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Get a platform role and its permissions' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiNotFoundResponse({ description: 'AUTHORIZATION_ROLE_NOT_FOUND.' })
  @ApiOkResponse({
    description: 'Role detail and permission catalogue entries.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  role(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
  ): Promise<AuthorizationRoleDetail> {
    return this.roleService.get(platform, roleId);
  }

  /** Updates role metadata using the caller's expected version. */
  @Patch(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Update platform role metadata' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiConflictResponse({
    description:
      'AUTHORIZATION_ROLE_VERSION_CONFLICT or a protected-role error.',
  })
  @ApiOkResponse({ description: 'Updated role with incremented version.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  updateRole(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() dto: UpdateAuthorizationRoleDto,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ): Promise<AuthorizationRoleDetail> {
    return this.roleCommandService.update(
      platform,
      roleId,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  /** Soft-deletes an unused custom role when platform safety allows it. */
  @Delete(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Soft-delete an unused custom role' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiConflictResponse({
    description:
      'AUTHORIZATION_ROLE_IN_USE or AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE.',
  })
  @ApiOkResponse({ description: 'Soft-deleted role.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  deleteRole(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ): Promise<AuthorizationRoleDeletionResult> {
    return this.roleCommandService.delete(
      platform,
      roleId,
      principal.id,
      this.requestId(request),
    );
  }

  /** Replaces the complete permission set for one role. */
  @Put(':platform/roles/:roleId/permissions')
  @ApiOperation({ summary: 'Replace a role permission set atomically' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiConflictResponse({
    description: 'Version, platform, assignment, or invariant failure.',
  })
  @ApiOkResponse({
    description: 'Role with the complete replacement permission set.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  replaceRolePermissions(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ): Promise<AuthorizationRoleDetail> {
    return this.roleCommandService.replacePermissions(
      platform,
      roleId,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  /** Lists subjects currently assigned to one exact role. */
  @Get(':platform/roles/:roleId/subjects')
  @ApiOperation({ summary: 'List subjects assigned to a role' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiOkResponse({ description: 'Paginated subjects and usage information.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  roleSubjects(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Query() query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    return this.roleSubjectService.listForRole(platform, roleId, query);
  }

  /** Lists the platform-owned permission catalogue. */
  @Get(':platform/permissions')
  @ApiOperation({ summary: 'Search the code-owned permission catalogue' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiOkResponse({
    description: 'Paginated catalogue; deprecated entries are opt-in.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permissions(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    return this.permissionService.list(platform, query);
  }

  /** Returns one exact permission and its role usage. */
  @Get(':platform/permissions/:permissionId')
  @ApiOperation({ summary: 'Get permission metadata and usage' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiNotFoundResponse({ description: 'AUTHORIZATION_PERMISSION_NOT_FOUND.' })
  @ApiOkResponse({ description: 'Permission detail and roles using it.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permission(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('permissionId', new ParseUUIDPipe()) permissionId: string,
  ): Promise<AuthorizationPermissionDetail> {
    return this.permissionService.get(platform, permissionId);
  }

  /** Lists platform roles that use one exact permission. */
  @Get(':platform/permissions/:permissionId/roles')
  @ApiOperation({ summary: 'List roles using a permission' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiNotFoundResponse({ description: 'AUTHORIZATION_PERMISSION_NOT_FOUND.' })
  @ApiOkResponse({ description: 'Roles using the exact platform permission.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permissionRoles(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('permissionId', new ParseUUIDPipe()) permissionId: string,
  ): Promise<AuthorizationPermissionRolesResult> {
    return this.permissionService.roles(platform, permissionId);
  }

  /** Returns the deterministic role-permission matrix for a platform. */
  @Get(':platform/matrix')
  @ApiOperation({ summary: 'Get a role-permission matrix' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiOkResponse({
    description: 'Deterministically ordered roles, groups, and assignments.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  matrix(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
  ): Promise<AuthorizationMatrixResult> {
    return this.service.matrix(platform);
  }

  /** Lists subjects using platform-specific identity semantics. */
  @Get(':platform/subjects')
  @ApiOperation({ summary: 'Search platform authorization subjects' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiOkResponse({ description: 'Paginated exact-domain subjects.' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  subjects(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationSubjectListResult> {
    return this.subjectService.list(platform, query);
  }

  /** Returns one exact subject from the selected platform. */
  @Get(':platform/subjects/:subjectId')
  @ApiOperation({ summary: 'Get subject roles and effective permissions' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiNotFoundResponse({ description: 'AUTHORIZATION_SUBJECT_NOT_FOUND.' })
  @ApiOkResponse({
    description: 'Exact subject detail with effective permissions.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  subject(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
  ): Promise<AuthorizationSubjectDetail> {
    return this.subjectService.get(platform, subjectId);
  }

  /** Replaces the complete role set for one exact subject. */
  @Put(':platform/subjects/:subjectId/roles')
  @ApiOperation({ summary: 'Replace subject role assignments atomically' })
  @ApiParam({ name: 'platform', enum: AuthorizationPlatform })
  @ApiConflictResponse({
    description: 'Platform mismatch, disabled role, or invariant failure.',
  })
  @ApiOkResponse({
    description: 'Subject detail after replacement and audit commit.',
  })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_WRITE,
  )
  replaceSubjectRoles(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Body() dto: ReplaceSubjectRolesDto,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ): Promise<AuthorizationSubjectDetail> {
    return this.roleSubjectService.replaceRoles(
      platform,
      subjectId,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  private requestId(request: Request): string | null {
    return (request as RequestWithContext).requestId ?? null;
  }
}
