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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { AuthorizationManagementService } from '../services/authorization-management.service';

/** UI-ready Administration-only management API for all platform auth domains. */
@ApiTags('Administration Authorization')
@ApiBearerAuth()
@Controller('administration/authorization')
@UseGuards(AdministrationJwtAuthGuard, AdministrationPermissionsGuard)
export class AuthorizationManagementController {
  constructor(private readonly service: AuthorizationManagementService) {}

  @Get('platforms')
  @ApiOperation({ summary: 'List authorization platforms' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PLATFORM_READ,
  )
  platforms() {
    return this.service.platforms();
  }

  @Get('audit')
  @ApiOperation({ summary: 'Search authorization audit events' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_AUDIT_READ,
  )
  audit(@Query() query: AuthorizationAuditQueryDto) {
    return this.service.audit(query);
  }

  @Get(':platform/roles')
  @ApiOperation({ summary: 'List platform roles' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  roles(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationRoleListQueryDto,
  ) {
    return this.service.listRoles(platform, query);
  }

  @Post(':platform/roles')
  @ApiOperation({ summary: 'Create a custom platform role' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  createRole(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Body() dto: CreateAuthorizationRoleDto,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ) {
    return this.service.createRole(
      platform,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  @Get(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Get a platform role and its permissions' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  role(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
  ) {
    return this.service.getRole(platform, roleId);
  }

  @Patch(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Update platform role metadata' })
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
  ) {
    return this.service.updateRole(
      platform,
      roleId,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  @Delete(':platform/roles/:roleId')
  @ApiOperation({ summary: 'Soft-delete an unused custom role' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
  )
  deleteRole(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @CurrentUser() principal: AdministrationPrincipal,
    @Req() request: Request,
  ) {
    return this.service.deleteRole(
      platform,
      roleId,
      principal.id,
      this.requestId(request),
    );
  }

  @Put(':platform/roles/:roleId/permissions')
  @ApiOperation({ summary: 'Replace a role permission set atomically' })
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
  ) {
    return this.service.replaceRolePermissions(
      platform,
      roleId,
      dto,
      principal.id,
      this.requestId(request),
    );
  }

  @Get(':platform/roles/:roleId/subjects')
  @ApiOperation({ summary: 'List subjects assigned to a role' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  roleSubjects(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Query() query: AuthorizationSubjectListQueryDto,
  ) {
    return this.service.roleSubjects(platform, roleId, query);
  }

  @Get(':platform/permissions')
  @ApiOperation({ summary: 'Search the code-owned permission catalogue' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permissions(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationPermissionListQueryDto,
  ) {
    return this.service.listPermissions(platform, query);
  }

  @Get(':platform/permissions/:permissionId')
  @ApiOperation({ summary: 'Get permission metadata and usage' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permission(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('permissionId', new ParseUUIDPipe()) permissionId: string,
  ) {
    return this.service.getPermission(platform, permissionId);
  }

  @Get(':platform/permissions/:permissionId/roles')
  @ApiOperation({ summary: 'List roles using a permission' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
  )
  permissionRoles(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('permissionId', new ParseUUIDPipe()) permissionId: string,
  ) {
    return this.service.permissionRoles(platform, permissionId);
  }

  @Get(':platform/matrix')
  @ApiOperation({ summary: 'Get a role-permission matrix' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
  )
  matrix(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
  ) {
    return this.service.matrix(platform);
  }

  @Get(':platform/subjects')
  @ApiOperation({ summary: 'Search platform authorization subjects' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  subjects(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Query() query: AuthorizationSubjectListQueryDto,
  ) {
    return this.service.listSubjects(platform, query);
  }

  @Get(':platform/subjects/:subjectId')
  @ApiOperation({ summary: 'Get subject roles and effective permissions' })
  @AdministrationPermissionRequire(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
  )
  subject(
    @Param('platform', new ParseEnumPipe(AuthorizationPlatform))
    platform: AuthorizationPlatform,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
  ) {
    return this.service.getSubject(platform, subjectId);
  }

  @Put(':platform/subjects/:subjectId/roles')
  @ApiOperation({ summary: 'Replace subject role assignments atomically' })
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
  ) {
    return this.service.replaceSubjectRoles(
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
