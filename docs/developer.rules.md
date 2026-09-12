# Nexus Estate API Gateway — Developer Rules

> This document is the **single source of truth** for architecture, conventions, and development rules of the Nexus Estate API Gateway.
> Every team member must read and follow these rules before contributing code.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Project Structure](#2-project-structure)
3. [Abstraction Layer](#3-abstraction-layer)
4. [NestJS Module Conventions](#4-nestjs-module-conventions)
5. [Naming Conventions](#5-naming-conventions)
6. [TypeScript & Type Safety](#6-typescript--type-safety)
7. [Entity & Database Rules](#7-entity--database-rules)
8. [DTO & Validation Rules](#8-dto--validation-rules)
9. [Service Layer Rules](#9-service-layer-rules)
10. [Controller Rules](#10-controller-rules)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Error Handling](#12-error-handling)
13. [Testing Rules](#13-testing-rules)
14. [Import Rules](#14-import-rules)
15. [Migration Rules](#15-migration-rules)
16. [Code Review Checklist](#16-code-review-checklist)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│              (Web App / Mobile / Third-party)                │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API (JSON)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  API Gateway (this repo)                      │
│    NestJS + TypeORM + PostgreSQL + JWT + Passport             │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Auth   │  │   User   │  │   RBAC   │  │  Future  │     │
│  │  Module  │  │  Module  │  │  Module  │  │ Modules  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │          Abstraction Layer (Base Classes)             │    │
│  │  BaseEntity │ BaseRepository │ BaseService            │    │
│  │  ApprovalBaseEntity │ BaseQueryBuilder                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │          Common Layer (Cross-cutting Concerns)        │    │
│  │  Filters │ Interceptors │ Guards │ Helpers            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────────┘
                       │ TypeORM
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │   (Database)    │
              └─────────────────┘
```

### 1.2 Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── TypeOrmModule (async, global)
├── CommonModule (global: filters, interceptors)
├── AuthModule
│   ├── JwtModule (async config)
│   ├── PassportModule
│   └── imports UserModule
├── UserModule
│   ├── TypeOrmModule.forFeature([User, DataPool])
│   └── imports RbacModule (for default role assignment)
└── RbacModule
    └── TypeOrmModule.forFeature([Role, Permission])

Global Guards (APP_GUARD):
├── RolesGuard
└── PermissionsGuard
```

### 1.3 Request Lifecycle

```
Request → Global Guards (Roles/Permissions)
        → Interceptors (Logging → Transform)
        → Controller → Service → Repository → Database
        → Response Transform → Client
```

Exception flow:

```
Exception → BusinessExceptionFilter (BusinessException)
          → HttpExceptionFilter (all other HttpException)
          → Standard NestJS handler (unhandled)
```

---

## 2. Project Structure

```
src/
├── main.ts                          # Bootstrap (port from PORT env, CORS enabled)
├── app.module.ts                    # Root module
│
├── common/                          # Cross-cutting concerns (global)
│   ├── common.module.ts             # Registers filters, interceptors globally
│   ├── decorators/
│   │   └── public.decorator.ts      # @Public() - skip JWT auth
│   ├── exceptions/
│   │   └── business.exception.ts    # BusinessException class
│   ├── filters/
│   │   ├── business-exception.filter.ts  # Catches BusinessException
│   │   └── http-exception.filter.ts      # Catches HttpException
│   └── interceptors/
│       ├── logging.interceptor.ts   # Request/response logging with timing
│       └── transform.interceptor.ts # Wraps response in { data, timestamp }
│
├── database/
│   ├── database.module.ts           # TypeORM module configuration
│   ├── type.config.ts               # TypeORM DataSource config (for CLI & app)
│   └── migrations/
│       ├── 1741614400000-CreateUserTable.ts
│       ├── 1741614500000-CreateDataPoolTable.ts
│       └── 1741614600000-CreateRbacTables.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       # POST /auth/signup, signin, refresh, GET /auth/profile
│   │   ├── auth.service.ts          # Auth business logic
│   │   ├── dto/
│   │   │   └── refresh-token.dto.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts    # AuthGuard('jwt')
│   │   │   └── local-auth.guard.ts  # AuthGuard('local')
│   │   └── strategies/
│   │       ├── jwt.strategy.ts      # JWT validation strategy
│   │       └── local.strategy.ts    # Email/password strategy
│   │
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts       # POST /users, GET /users/:id, PATCH /users/:id, PUT /users/:id/password
│   │   ├── user.service.ts          # Extends BaseService<User>
│   │   ├── user.repository.ts       # Extends BaseRepository<User>
│   │   ├── dto/
│   │   │   ├── create-user-dto.ts   # RegisterUserDto
│   │   │   └── update-user-dto.ts   # UpdateUserDto, ChangePasswordDto
│   │   └── entities/
│   │       ├── user.entity.ts       # User entity (tbl_user)
│   │       └── data-pool.entity.ts  # DataPool entity (tbl_data_pool)
│   │
│   └── rbac/
│       ├── rbac.module.ts
│       ├── rbac.controller.ts       # POST/GET /rbac/roles, /rbac/permissions
│       ├── role.service.ts          # Extends BaseService<Role>
│       ├── permission.service.ts    # Extends BaseService<Permission>
│       ├── role.repository.ts       # Extends BaseRepository<Role>
│       ├── permission.repository.ts # Extends BaseRepository<Permission>
│       ├── dto/
│       │   ├── create-role.dto.ts
│       │   ├── update-role.dto.ts
│       │   ├── assign-role.dto.ts
│       │   └── index.ts
│       ├── entities/
│       │   ├── role.entity.ts       # Role entity (tbl_role)
│       │   ├── permission.entity.ts # Permission entity (tbl_permission)
│       │   └── index.ts
│       ├── guards/
│       │   ├── roles.guard.ts       # Global RolesGuard
│       │   └── permissions.guard.ts # Global PermissionsGuard
│       └── decorators/
│           ├── roles.decorator.ts
│           ├── permissions.decorator.ts
│           └── index.ts
│
├── services/
│   └── abstraction-services/        # ★ Abstraction layer (SINGLE source)
│       ├── base.entity.ts           # BaseEntity (UUID, timestamps, audit)
│       ├── approval-base.entity.ts  # ApprovalBaseEntity (approval workflow)
│       ├── base.repository.ts       # BaseRepository<T> (generic CRUD)
│       ├── base.service.ts          # BaseService<T, C, U> (generic business logic)
│       ├── base-query-builder.ts    # BaseQueryBuilder<T> (fluent queries)
│       ├── index.ts                 # Barrel export
│       ├── decorators/
│       │   ├── roles.decorator.ts
│       │   ├── permissions.decorator.ts
│       │   └── index.ts
│       └── interfaces/
│           ├── pagination.interface.ts
│           ├── repository.interface.ts
│           ├── service.interface.ts
│           └── index.ts
│
└── utils/
    ├── index.ts                     # Barrel export
    ├── constants/
    │   ├── error.constant.ts        # ErrorCodes (18 standardized error definitions)
    │   ├── permission.constant.ts   # PermissionName enum
    │   ├── role.constant.ts         # RoleName enum
    │   └── index.ts
    └── helpers/
        ├── index.ts
        ├── date.helper.ts
        ├── hash.helper.ts
        ├── pagination.helper.ts
        ├── token.helper.ts
        ├── validation.helper.ts
        └── __tests__/
            ├── date.helper.spec.ts
            ├── hash.helper.spec.ts
            ├── pagination.helper.spec.ts
            ├── token.helper.spec.ts
            └── validation.helper.spec.ts
```

**Ownership rules:**
- `src/common` contains NestJS-aware cross-cutting components only.
- Reusable helpers belong in `src/utils/helpers` and must be exported from its `index.ts`.
- Do not create a second helper implementation or re-export helpers through `src/common`.

---

## 3. Abstraction Layer

All abstract base classes live in `src/services/abstraction-services/`. This is the **only** abstraction layer in the project.

### 3.1 BaseEntity

```typescript
// src/services/abstraction-services/base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;       // Soft-delete support

  @Column({ nullable: true })
  createdBy?: string;     // Audit: who created

  @Column({ nullable: true })
  updatedBy?: string;     // Audit: who last updated
}
```

**Rules:**
- Every entity MUST extend `BaseEntity` (or `ApprovalBaseEntity`).
- Never create your own `id`, `createdAt`, `updatedAt`, `deletedAt` columns — they come from `BaseEntity`.
- Soft-delete is the default. Use `softDelete()` from `BaseRepository`, not `hardDelete()`.

### 3.2 ApprovalBaseEntity

```typescript
// src/services/abstraction-services/approval-base.entity.ts
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export abstract class ApprovalBaseEntity extends BaseEntity {
  @Column({ type: 'varchar', default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ nullable: true })
  approvedDate?: Date;

  @Column({ nullable: true })
  rejectedBy?: string;

  @Column({ nullable: true })
  rejectedDate?: Date;

  @Column({ nullable: true })
  rejectionReason?: string;
}
```

**Use when:** An entity requires an approval workflow (e.g., property listings, broker verification).

### 3.3 BaseRepository\<T\>

Provides generic CRUD operations for any entity extending `BaseEntity`.

| Method | Description |
|--------|-------------|
| `create(data)` | Create and save a new entity |
| `findById(id)` | Find by UUID (returns `null` if not found) |
| `findOne(where)` | Find one by conditions |
| `findAll(where?)` | Find all matching entities |
| `findAllPaginated(options)` | Find with pagination (page/limit) |
| `update(id, data)` | Update entity by id |
| `softDelete(id)` | Soft-delete (sets `deletedAt`) |
| `hardDelete(id)` | Permanent delete (use with caution) |
| `count(where?)` | Count matching entities |
| `transaction(callback)` | Execute operations in a database transaction |
| `createQueryBuilder(alias)` | Create a `BaseQueryBuilder` instance |

**Pagination defaults:**
- `page`: minimum `1`
- `limit`: minimum `10`, maximum `100`

**Example — Custom Repository:**

```typescript
// src/modules/user/user.repository.ts
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
  ) {
    super(repository);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email }, relations: ['role'] });
  }
}
```

### 3.4 BaseService\<T, CreateDto, UpdateDto\>

Provides business logic layer on top of `BaseRepository`.

| Method | Description |
|--------|-------------|
| `create(dto)` | Create entity from DTO |
| `findOne(id)` | Find by ID or throw `RESOURCE_NOT_FOUND` |
| `findAll()` | Return all entities |
| `update(id, dto)` | Update entity by ID |
| `remove(id)` | Soft-delete entity by ID |

**Example — Custom Service:**

```typescript
// src/modules/user/user.service.ts
@Injectable()
export class UserService extends BaseService<User, RegisterUserDto, UpdateUserDto> {
  protected override readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {
    super(userRepository, 'User');  // 'User' = entity name for error messages
  }

  async handleSignUp(dto: RegisterUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing)
      throw new BusinessException(ErrorCodes.USER_EMAIL_EXISTS, dto.email);

    return this.userRepository.transaction(async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const buyerRole = await roleRepo.findOne({ where: { name: RoleName.BUYER } });
      // ... hash password, create user with role
    });
  }
}
```

### 3.5 BaseQueryBuilder\<T\>

Fluent wrapper around TypeORM's `SelectQueryBuilder` with pagination support.

| Method | Description |
|--------|-------------|
| `andWhere(condition, params?)` | Add AND condition |
| `orWhere(condition, params?)` | Add OR condition |
| `innerJoin(relation, alias)` | Inner join |
| `leftJoin(relation, alias)` | Left join |
| `leftJoinAndSelect(relation, alias)` | Left join with select |
| `orderBy(field, order)` | Order by field |
| `addOrderBy(field, order)` | Add secondary ordering |
| `select(fields)` | Select specific fields |
| `paginate(page, limit)` | Apply pagination (page min 1, limit 1–100) |
| `getMany()` | Execute and return array |
| `getOne()` | Execute and return single result |
| `getRawMany()` | Execute and return raw results |
| `getCount()` | Execute and return count |

### 3.6 Interfaces

```typescript
// PaginationOptions — input for paginated queries
interface PaginationOptions {
  page?: number;   // default: 1
  limit?: number;  // default: 10, max: 100
}

// PaginatedResult<T> — output from paginated queries
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// IBaseRepository<T> — repository interface
// IBaseService<T, CreateDto, UpdateDto> — service interface
```

### 3.7 Barrel Export

```typescript
// src/services/abstraction-services/index.ts
export { BaseEntity } from './base.entity';
export { ApprovalBaseEntity, ApprovalStatus } from './approval-base.entity';
export { BaseRepository } from './base.repository';
export { BaseService } from './base.service';
export { BaseQueryBuilder } from './base-query-builder';
```

**Always import from the barrel:**

```typescript
// ✅ Correct
import { BaseEntity, BaseRepository, BaseService } from '../../services/abstraction-services';

// ❌ Wrong — do not import from individual files
import { BaseEntity } from '../../services/abstraction-services/base.entity';
```

---

## 4. NestJS Module Conventions

### 4.1 Module Structure

Every feature module follows this pattern:

```
src/modules/<feature>/
├── <feature>.module.ts           # Module definition
├── <feature>.controller.ts       # REST endpoints
├── <feature>.service.ts          # Business logic (extends BaseService)
├── <feature>.repository.ts       # Data access (extends BaseRepository)
├── dto/
│   ├── create-<feature>.dto.ts   # Create DTO
│   ├── update-<feature>.dto.ts   # Update DTO
│   └── index.ts                  # Barrel export
├── entities/
│   ├── <feature>.entity.ts       # TypeORM entity (extends BaseEntity)
│   └── index.ts                  # Barrel export
├── guards/                       # (optional) Feature-specific guards
└── decorators/                   # (optional) Feature-specific decorators
```

### 4.2 Module Registration

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Entity1, Entity2]),  // Register entities
    OtherModule,                                    // Import dependencies
  ],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService],  // Export service for other modules
})
export class FeatureModule {}
```

---

## 5. Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| **File** | `kebab-case` | `create-user-dto.ts`, `jwt-auth.guard.ts` |
| **Class** | `PascalCase` | `UserService`, `CreateRoleDto` |
| **Interface** | `PascalCase` with `I` prefix | `IBaseRepository`, `IBaseService` |
| **Method** | `camelCase` with `handle` prefix for service public methods | `handleSignUp`, `handleFindByEmail` |
| **Entity table** | `tbl_` prefix + `snake_case` | `tbl_user`, `tbl_role`, `tbl_permission` |
| **Entity class** | `PascalCase` singular | `User`, `Role`, `Permission` |
| **Constant** | `UPPER_SNAKE_CASE` | `ErrorCodes.USER_NOT_FOUND`, `RoleName.ADMIN` |
| **Enum** | `PascalCase` enum, `UPPER_SNAKE_CASE` values | `RoleName.BUYER`, `ApprovalStatus.PENDING` |
| **DTO** | `<Action><Entity>Dto` | `RegisterUserDto`, `CreateRoleDto`, `UpdateUserDto` |
| **Guard** | `<Name>Guard` | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` |
| **Strategy** | `<Name>Strategy` | `JwtStrategy`, `LocalStrategy` |
| **Filter** | `<Name>Filter` | `BusinessExceptionFilter`, `HttpExceptionFilter` |
| **Interceptor** | `<Name>Interceptor` | `TransformInterceptor`, `LoggingInterceptor` |
| **Migration** | `<timestamp>-<Description>.ts` | `1741614400000-CreateUserTable.ts` |

---

## 6. TypeScript & Type Safety

### 6.1 Strict Rules

- **`any` is PROHIBITED.** Use concrete types or `unknown` with explicit type guards.
- **No `@ts-ignore` or `@ts-nocheck`.** Fix the type error instead.
- **No `eslint-disable` without explicit justification** documented in a comment.

### 6.2 Global Type Declarations

```typescript
// src/types/type.d.ts
interface AuthUser {
  id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

declare namespace Express {
  interface Request {
    user?: AuthUser;
  }
}
```

- `AuthUser` is available globally — no import needed.
- Use `req.user as AuthUser` in controllers after JWT guard validation.

---

## 7. Entity & Database Rules

### 7.1 Entity Requirements

```typescript
import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../services/abstraction-services';

@Entity('tbl_example')
@Unique(['uniqueField'])
export class Example extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;
}
```

**Rules:**
- Always extend `BaseEntity` or `ApprovalBaseEntity`.
- Use `@Entity('tbl_<name>')` with `tbl_` prefix.
- Use `@Unique()` for business-level unique constraints.
- Use `class-transformer` `@Exclude()` for sensitive fields (e.g., password).

### 7.2 Current Entities

| Entity | Table | Extends | Key Fields |
|--------|-------|---------|------------|
| `User` | `tbl_user` | `BaseEntity` | email, password (@Exclude), roleId, isEmailVerified, lastLogin |
| `DataPool` | `tbl_data_pool` | `BaseEntity` | userId, key, value (JSON), unique: [userId, key] |
| `Role` | `tbl_role` | `BaseEntity` | name (unique), description, permissions (ManyToMany) |
| `Permission` | `tbl_permission` | `BaseEntity` | name (unique, PermissionName enum), description |

### 7.3 Relations

```
User ──ManyToOne──▶ Role
User ──OneToMany──▶ DataPool
Role ──ManyToMany──▶ Permission (join table: tbl_role_permissions)
```

### 7.4 Soft Delete

All entities support soft-delete via `deletedAt` from `BaseEntity`. TypeORM automatically excludes soft-deleted records from queries. Use `softDelete(id)` from `BaseRepository`.

---

## 8. DTO & Validation Rules

### 8.1 Validation with class-validator

```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**Rules:**
- Every DTO field MUST have at least one `class-validator` decorator.
- Use `@IsOptional()` for optional fields.
- DTOs are for input validation only — never use entities as DTOs.
- Name DTOs as `<Action><Entity>Dto` (e.g., `RegisterUserDto`, `CreateRoleDto`).

### 8.2 Current DTOs

| DTO | Module | Fields |
|-----|--------|--------|
| `RegisterUserDto` | User | email, password |
| `UpdateUserDto` | User | email? |
| `ChangePasswordDto` | User | currentPassword, newPassword |
| `RefreshTokenDto` | Auth | refreshToken |
| `CreateRoleDto` | RBAC | name, description?, permissionIds? |
| `UpdateRoleDto` | RBAC | name?, description?, permissionIds? |
| `AssignRoleDto` | RBAC | roleId |

---

## 9. Service Layer Rules

### 9.1 Service Pattern

```typescript
@Injectable()
export class FeatureService extends BaseService<Feature, CreateDto, UpdateDto> {
  protected override readonly logger = new Logger(FeatureService.name);

  constructor(private readonly featureRepository: FeatureRepository) {
    super(featureRepository, 'Feature');
  }

  // Custom business methods prefixed with "handle"
  async handleCustomAction(dto: SomeDto): Promise<Feature> {
    // Business logic here
  }
}
```

**Rules:**
- Every service MUST extend `BaseService` (unless it has no entity, like `AuthService`).
- Use the `handle` prefix for public business methods (e.g., `handleSignUp`, `handleFindByEmail`).
- Inject repositories, never inject TypeORM `Repository<T>` directly into services.
- Throw `BusinessException` with appropriate `ErrorCodes` for business rule violations.
- Use `this.repository.transaction()` for operations that modify multiple tables.

### 9.2 Transaction Pattern

```typescript
async handleSignUp(dto: RegisterUserDto): Promise<User> {
  return this.userRepository.transaction(async (manager) => {
    const roleRepo = manager.getRepository(Role);
    const buyerRole = await roleRepo.findOne({ where: { name: RoleName.BUYER } });
    
    const user = manager.create(User, {
      ...dto,
      password: await HashHelper.hash(dto.password),
      role: buyerRole,
    });
    
    return manager.save(user);
  });
}
```

---

## 10. Controller Rules

### 10.1 Controller Pattern

```typescript
@Controller('feature')
export class FeatureController {
  private readonly logger = new Logger(FeatureController.name);

  constructor(private readonly featureService: FeatureService) {}

  @Post()
  async create(@Body() dto: CreateDto) {
    this.logger.log(`Creating feature: ${dto.name}`);
    return this.featureService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.featureService.findOne(id);
  }
}
```

**Rules:**
- Controllers MUST be thin — no business logic, only routing + validation + logging.
- Use `ParseUUIDPipe` for all UUID path params.
- Use `@Body()` with DTO classes for request body validation.
- Use `Logger` for request logging.
- Delegate all logic to the service layer.

### 10.2 Current API Endpoints

#### Auth Module (`/auth`)

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| `POST` | `/auth/signup` | None | Register new user |
| `POST` | `/auth/signin` | `LocalAuthGuard` | Login with email/password |
| `POST` | `/auth/refresh` | None | Refresh access token |
| `GET` | `/auth/profile` | `JwtAuthGuard` | Get current user profile |

#### User Module (`/users`)

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| `POST` | `/users` | None | Create user |
| `GET` | `/users/:id` | None | Get user by ID |
| `PATCH` | `/users/:id` | None | Update user |
| `PUT` | `/users/:id/password` | None | Change password |

#### RBAC Module (`/rbac`)

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| `POST` | `/rbac/roles` | None | Create role |
| `GET` | `/rbac/roles` | None | List all roles |
| `GET` | `/rbac/roles/:id` | None | Get role with permissions |
| `POST` | `/rbac/roles/:id/permissions` | None | Assign permissions to role |
| `POST` | `/rbac/permissions` | None | Create permission |
| `GET` | `/rbac/permissions` | None | List all permissions |

---

## 11. Authentication & Authorization

### 11.1 Authentication Flow

```
┌─────────┐     POST /auth/signin      ┌────────────────┐
│  Client  │ ──────────────────────────▶│ LocalAuthGuard │
│          │  { email, password }       │ (LocalStrategy)│
└─────────┘                             └───────┬────────┘
                                                │ validate
                                                ▼
                                        ┌───────────────┐
                                        │  AuthService   │
                                        │ handleSignin() │
                                        └───────┬───────┘
                                                │ returns
                                                ▼
                                        { accessToken, refreshToken }
```

### 11.2 JWT Configuration

- **Access Token**: Short-lived (configurable via env)
- **Refresh Token**: Long-lived (configurable via env)
- **Secret**: `JWT_SECRET` environment variable (required)
- **Strategy**: Extract from `Authorization: Bearer <token>` header

### 11.3 Guards

| Guard | Scope | Purpose |
|-------|-------|---------|
| `JwtAuthGuard` | Per-route | Validates JWT token, populates `req.user` |
| `LocalAuthGuard` | Per-route | Validates email/password via Passport local strategy |
| `RolesGuard` | **Global** (APP_GUARD) | Checks `@ROLES_REQUIRED()` metadata |
| `PermissionsGuard` | **Global** (APP_GUARD) | Checks `@PERMISSIONS_REQUIRED()` metadata |

### 11.4 Decorators

```typescript
// Skip JWT authentication
@Public()
@Get('public-endpoint')
async publicEndpoint() { ... }

// Require specific roles
@ROLES_REQUIRED(RoleName.ADMIN, RoleName.BROKER)
@Get('admin-only')
async adminOnly() { ... }

// Require specific permissions
@PERMISSIONS_REQUIRED(PermissionName.USER_READ, PermissionName.USER_WRITE)
@Get('requires-permission')
async requiresPermission() { ... }
```

### 11.5 Roles & Permissions

**Roles** (`RoleName` enum):

| Role | Description |
|------|-------------|
| `ADMIN` | System administrator |
| `BROKER` | Real estate broker |
| `BUYER` | Property buyer (default for new users) |

**Permissions** (`PermissionName` enum):
- Defined in `src/utils/constants/permission.constant.ts`
- Assigned to roles via ManyToMany relationship
- Checked by `PermissionsGuard` at runtime

---

## 12. Error Handling

### 12.1 BusinessException

```typescript
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../utils/constants/error.constant';

// Simple error
throw new BusinessException(ErrorCodes.USER_NOT_FOUND);

// Error with dynamic message (replaces %s in message template)
throw new BusinessException(ErrorCodes.USER_EMAIL_EXISTS, 'john@example.com');
```

### 12.2 ErrorCode Structure

```typescript
interface ErrorCode {
  code: string;       // Machine-readable code (e.g., 'AUTH_001')
  message: string;    // Human-readable message (supports %s substitution)
  httpStatus: number; // HTTP status code
}
```

### 12.3 Error Code Registry

| Constant | Code | HTTP | Message |
|----------|------|------|---------|
| `UNAUTHORIZED` | AUTH_001 | 401 | Authentication required |
| `INVALID_CREDENTIALS` | AUTH_002 | 401 | Invalid email or password |
| `TOKEN_EXPIRED` | AUTH_003 | 401 | Token has expired |
| `TOKEN_INVALID` | AUTH_004 | 401 | Token is invalid or malformed |
| `FORBIDDEN` | AUTH_005 | 403 | No permission to perform action |
| `VALIDATION_ERROR` | VAL_001 | 400 | Validation failed |
| `INVALID_INPUT` | VAL_002 | 400 | Invalid input data |
| `RESOURCE_NOT_FOUND` | RES_001 | 404 | Resource %s not found |
| `RESOURCE_ALREADY_EXISTS` | RES_002 | 409 | Resource %s already exists |
| `RESOURCE_CONFLICT` | RES_003 | 409 | Resource conflict |
| `USER_NOT_FOUND` | USR_001 | 404 | User not found |
| `USER_EMAIL_EXISTS` | USR_002 | 409 | Email %s is already registered |
| `USER_INVALID_PASSWORD` | USR_003 | 400 | Current password is incorrect |
| `ROLE_NOT_FOUND` | ROLE_001 | 404 | Role not found |
| `ROLE_ALREADY_EXISTS` | ROLE_002 | 409 | Role %s already exists |
| `PERMISSION_NOT_FOUND` | PERM_001 | 404 | Permission not found |
| `INTERNAL_ERROR` | SYS_001 | 500 | Internal server error |
| `DATABASE_ERROR` | SYS_002 | 500 | Database operation failed |

### 12.4 Response Format

All responses are wrapped by `TransformInterceptor`:

```json
// Success response
{
  "data": { ... },
  "timestamp": "2026-07-11T06:00:00.000Z"
}

// Error response (from BusinessExceptionFilter)
{
  "statusCode": 404,
  "code": "USR_001",
  "message": "User not found",
  "timestamp": "2026-07-11T06:00:00.000Z"
}
```

---

## 13. Testing Rules

### 13.1 Test Structure

```
src/                              # Unit tests (colocated)
├── app.module.spec.ts
├── main.spec.ts
├── database/type.config.spec.ts
└── utils/helpers/__tests__/
    ├── date.helper.spec.ts
    ├── hash.helper.spec.ts
    ├── pagination.helper.spec.ts
    ├── token.helper.spec.ts
    └── validation.helper.spec.ts

test/                             # Integration & E2E tests
├── app.e2e-spec.ts
└── integration/
    ├── database.integration-spec.ts
    ├── rbac.integration-spec.ts
    └── user.integration-spec.ts
```

### 13.2 Test Commands

```bash
npm test                  # Unit tests (Jest)
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:e2e          # Integration/E2E tests
npm run test:all          # Full pipeline: build + lint + unit + integration
```

### 13.3 Test Conventions

- Unit test files: `*.spec.ts` (colocated with source or in `__tests__/`)
- Integration test files: `*.integration-spec.ts` (in `test/integration/`)
- E2E test files: `*.e2e-spec.ts` (in `test/`)
- Use descriptive `describe` and `it` blocks.
- Mock external dependencies (database, JWT, etc.).
- Test success cases, failure cases, and edge cases.
- Never weaken assertions to make tests pass — fix the code instead.

---

## 14. Import Rules

### 14.1 Barrel Exports

Use barrel exports (`index.ts`) to simplify imports:

```typescript
// ✅ Import from barrel
import { BaseEntity, BaseRepository, BaseService } from '../../services/abstraction-services';
import { ErrorCodes } from '../../utils/constants';
import { HashHelper, TokenHelper } from '../../utils/helpers';

// ❌ Do not import from individual files
import { BaseEntity } from '../../services/abstraction-services/base.entity';
```

### 14.2 Import Order

1. Node.js built-in modules
2. NestJS framework imports (`@nestjs/*`)
3. Third-party libraries
4. Abstraction layer (`../../services/abstraction-services`)
5. Common modules (`../../common/*`)
6. Utils (`../../utils/*`)
7. Sibling module imports (`../other-module/*`)
8. Local imports (`./`)

### 14.3 Type-Only Imports

Use `import type` for type-only imports:

```typescript
import type { Request } from 'express';
```

---

## 15. Migration Rules

### 15.1 File Naming

```
<timestamp>-<DescriptionInPascalCase>.ts
```

Example: `1741614400000-CreateUserTable.ts`

### 15.2 Migration Template

```typescript
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateExampleTable1741614700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_example',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          { name: 'updated_by', type: 'uuid', isNullable: true },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_example');
  }
}
```

**Rules:**
- Every migration MUST have both `up()` and `down()` methods.
- `down()` must fully reverse the `up()` operation.
- Include all `BaseEntity` columns (id, created_at, updated_at, deleted_at, created_by, updated_by).
- Use `tbl_` prefix for table names.
- Use `snake_case` for column names in migrations (TypeORM maps to entity properties).
- Never modify existing migration files — create a new migration instead.

### 15.3 Current Migrations

| Timestamp | File | Description |
|-----------|------|-------------|
| 1741614400000 | `CreateUserTable` | Creates `tbl_user` table |
| 1741614500000 | `CreateDataPoolTable` | Creates `tbl_data_pool` table |
| 1741614600000 | `CreateRbacTables` | Creates `tbl_role`, `tbl_permission`, `tbl_role_permissions` |

---

## 16. Code Review Checklist

Before submitting a PR, verify:

### Architecture
- [ ] New entity extends `BaseEntity` or `ApprovalBaseEntity`
- [ ] New repository extends `BaseRepository<T>`
- [ ] New service extends `BaseService<T, CreateDto, UpdateDto>`
- [ ] Module follows the standard structure (controller, service, repository, dto, entities)

### Type Safety
- [ ] No `any` type usage
- [ ] No `@ts-ignore` or `@ts-nocheck`
- [ ] All function parameters and return types are typed
- [ ] DTOs have `class-validator` decorators

### Error Handling
- [ ] Business errors use `BusinessException` with `ErrorCodes`
- [ ] No silent error swallowing

### Database
- [ ] Migration has both `up()` and `down()`
- [ ] Table uses `tbl_` prefix
- [ ] Soft-delete used (not hard delete) unless explicitly required
- [ ] Transactions used for multi-table operations

### Security
- [ ] Sensitive fields excluded with `@Exclude()` (e.g., password)
- [ ] No secrets hardcoded
- [ ] Appropriate guards applied to endpoints

### API Contract
- [ ] New endpoints are documented through NestJS Swagger
- [ ] Response format follows `{ data, timestamp }` convention
- [ ] Error responses follow `{ statusCode, code, message, timestamp }` convention

### Testing
- [ ] Unit tests added/updated for new business logic
- [ ] Integration tests added for new API endpoints
- [ ] Tests cover success, failure, and edge cases

### Imports
- [ ] Use barrel imports (`index.ts`)
- [ ] No unused imports
- [ ] Import order follows conventions

---

## Environment Configuration

### Required Environment Variables

```env
NODE_ENV=development
PORT=50001
DB_POSTGRES_HOST=localhost
DB_POSTGRES_PORT=5432
DB_POSTGRES_USER=postgres
DB_POSTGRES_PASS=nexus
DB_POSTGRES_NAME=nexus_estate
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

See `.env.example` for the complete template.

---

## Common Commands

```bash
# Development
npm run start:dev           # Start with hot-reload
npm run build               # Build project

# Testing
npm test                    # Unit tests
npm run test:e2e            # Integration tests
npm run test:all            # Full pipeline

# Code Quality
npm run typecheck           # TypeScript check without emitting files
npm run lint:check          # ESLint without modifying files
npm run lint:fix            # Apply ESLint fixes locally
npm run format              # Prettier formatting

# Database
npm run typeorm -- migration:create <module>/migrations/<Name>
# Use src/database/migrations/platform for cross-module changes.
npm run migration:generate:platform  # Generate a platform migration from entity changes
npm run migration:check     # Check migration visibility against the database
npm run migration:run       # Run pending migrations
npm run migration:revert    # Revert last migration
