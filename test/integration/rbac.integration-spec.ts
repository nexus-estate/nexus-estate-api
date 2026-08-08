import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { Permission } from '../../src/modules/rbac/entities/permission.entity';

@Injectable()
class TestRbacService {
  private readonly logger = new Logger('TestRbacService');

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async seedDefaultRoles(): Promise<void> {
    const roles = [
      { name: 'ADMIN', description: 'System administrator', isSystem: true },
      { name: 'BROKER', description: 'Real estate broker', isSystem: true },
      { name: 'BUYER', description: 'Property buyer', isSystem: true },
    ];

    for (const role of roles) {
      const existing = await this.roleRepository.findOne({
        where: { name: role.name },
      });
      if (!existing) {
        await this.roleRepository.save(role);
        this.logger.log(`Created role: ${role.name}`);
      }
    }
  }

  async seedPermissionsForRole(
    roleName: string,
    permissionNames: string[],
  ): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role) return;

    for (const name of permissionNames) {
      const existing = await this.permissionRepository.findOne({
        where: { name },
      });
      if (!existing) {
        await this.permissionRepository.save({
          name,
          roleId: role.id,
          description: `Permission: ${name}`,
        });
      }
    }
  }

  async getRoleByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  async getPermissionsForRole(roleName: string): Promise<string[]> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role) return [];

    const permissions = await this.permissionRepository.find({
      where: { roleId: role.id },
    });

    return permissions.map((p) => p.name);
  }
}

describe('RBAC Integration Tests', () => {
  let service: TestRbacService;
  let module: TestingModule;

  const typeOrmConfig = {
    type: 'sqljs' as const,
    entities: [Role, Permission],
    synchronize: true,
    logging: false,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        TypeOrmModule.forRoot(typeOrmConfig),
        TypeOrmModule.forFeature([Role, Permission]),
      ],
      providers: [TestRbacService],
    }).compile();

    service = module.get<TestRbacService>(TestRbacService);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  describe('Default Roles', () => {
    it('should seed default roles successfully', async () => {
      await service.seedDefaultRoles();

      for (const name of ['ADMIN', 'BROKER', 'BUYER']) {
        const role = await service.getRoleByName(name);
        expect(role).toBeDefined();
        expect(role!.name).toBe(name);
        expect(role!.isSystem).toBe(true);
      }
    });

    it('should not create duplicate roles', async () => {
      await service.seedDefaultRoles(); // Run again
      const admin = await service.getRoleByName('ADMIN');
      expect(admin).toBeDefined();
      expect(admin!.name).toBe('ADMIN');
    });
  });

  describe('Permission Management', () => {
    it('should assign permissions to a role', async () => {
      await service.seedPermissionsForRole('ADMIN', [
        'user:create',
        'user:read',
        'user:update',
        'user:delete',
      ]);

      const perms = await service.getPermissionsForRole('ADMIN');
      expect(perms.length).toBe(4);
      expect(perms).toContain('user:create');
      expect(perms).toContain('user:read');
    });

    it('should not create duplicate permissions', async () => {
      await service.seedPermissionsForRole('ADMIN', [
        'user:create',
        'user:read',
      ]);
      const perms = await service.getPermissionsForRole('ADMIN');
      expect(perms.length).toBe(4); // Still 4, no duplicates
    });

    it('should return empty array for non-existent role', async () => {
      const perms = await service.getPermissionsForRole('NONEXISTENT');
      expect(perms).toEqual([]);
    });

    it('should retrieve permissions for a specific role only', async () => {
      await service.seedPermissionsForRole('BUYER', ['listing:read']);

      const adminPerms = await service.getPermissionsForRole('ADMIN');
      const buyerPerms = await service.getPermissionsForRole('BUYER');

      expect(adminPerms).not.toContain('listing:read');
      expect(buyerPerms).toContain('listing:read');
      expect(buyerPerms.length).toBe(1);
    });
  });
});
