import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import {
  PermissionService,
  CreatePermissionDto,
} from '../services/permission.service';
import { CreateRoleDto } from '../dto';

@Controller('rbac')
export class RbacController {
  private readonly logger = new Logger(RbacController.name);

  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post('roles')
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    this.logger.log(`Create role: ${createRoleDto.name}`);
    return this.roleService.create(createRoleDto);
  }

  @Get('roles')
  async findAllRoles() {
    return this.roleService.findAll();
  }

  @Get('roles/:id')
  async findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getRoleWithPermissions(id);
  }

  @Post('roles/:id/permissions')
  async assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissionIds: string[] },
  ) {
    await this.roleService.assignPermissions(id, body.permissionIds);
    return { message: 'Permissions assigned successfully' };
  }

  @Post('permissions')
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Get('permissions')
  async findAllPermissions() {
    return this.permissionService.findAll();
  }
}
