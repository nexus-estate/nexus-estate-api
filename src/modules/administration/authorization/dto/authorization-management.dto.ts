import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
  AuthorizationRoleStatus,
} from '../enums/authorization-platform.enum';

const ROLE_SORT_FIELDS = [
  'name',
  'code',
  'createdAt',
  'updatedAt',
  'assignmentCount',
  'permissionCount',
] as const;

const PERMISSION_SORT_FIELDS = [
  'name',
  'code',
  'category',
  'resource',
  'action',
  'createdAt',
  'updatedAt',
] as const;

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class AuthorizationPaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class AuthorizationRoleListQueryDto extends AuthorizationPaginationQueryDto {
  @ApiPropertyOptional({ example: 'reviewer' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional({ enum: AuthorizationRoleStatus })
  @IsOptional()
  @IsEnum(AuthorizationRoleStatus)
  status?: AuthorizationRoleStatus;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({ example: 'provider-account:approve' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  permissionCode?: string;

  @ApiPropertyOptional({ enum: ROLE_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(ROLE_SORT_FIELDS)
  sort: (typeof ROLE_SORT_FIELDS)[number] = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export class CreateAuthorizationRoleDto {
  @ApiProperty({ example: 'SUPPORT_AGENT' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/)
  code: string;

  @ApiProperty({ example: 'Support Agent' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Handles customer support workflows.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 500 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class UpdateAuthorizationRoleDto {
  @ApiPropertyOptional({ example: 'Senior Support Agent' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ enum: AuthorizationRoleStatus })
  @IsOptional()
  @IsEnum(AuthorizationRoleStatus)
  status?: AuthorizationRoleStatus;

  @ApiProperty({ example: 4, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class ReplaceRolePermissionsDto {
  @ApiProperty({ type: [String], maxItems: 500 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  permissionIds: string[];

  @ApiProperty({ example: 4, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class AuthorizationPermissionListQueryDto extends AuthorizationPaginationQueryDto {
  @ApiPropertyOptional({ example: 'listing' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ enum: AuthorizationRiskLevel })
  @IsOptional()
  @IsEnum(AuthorizationRiskLevel)
  riskLevel?: AuthorizationRiskLevel;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  isAssignable?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  includeDeprecated = false;

  @ApiPropertyOptional({ enum: PERMISSION_SORT_FIELDS, default: 'category' })
  @IsOptional()
  @IsIn(PERMISSION_SORT_FIELDS)
  sort: (typeof PERMISSION_SORT_FIELDS)[number] = 'category';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export class AuthorizationSubjectListQueryDto extends AuthorizationPaginationQueryDto {
  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
}

export class ReplaceSubjectRolesDto {
  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  roleIds: string[];

  @ApiPropertyOptional({ example: 'Assigned to moderation team' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

export class AuthorizationAuditQueryDto extends AuthorizationPaginationQueryDto {
  @ApiPropertyOptional({ enum: AuthorizationPlatform })
  @IsOptional()
  @IsEnum(AuthorizationPlatform)
  platform?: AuthorizationPlatform;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  actorAdministratorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  targetId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
