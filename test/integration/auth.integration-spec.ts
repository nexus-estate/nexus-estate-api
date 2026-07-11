import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/modules/user/entities/user.entity';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { Permission } from '../../src/modules/rbac/entities/permission.entity';
import { DataPool } from '../../src/modules/user/entities/data-pool.entity';
import { RegisterUserDto } from '../../src/modules/user/dto/create-user-dto';
import * as bcrypt from 'bcrypt';

@Injectable()
class TestAuthService {
  private readonly logger = new Logger('TestAuthService');

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async signup(dto: RegisterUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new Error('Email already exists');
    }

    const buyerRole = await this.roleRepository.findOne({
      where: { name: 'BUYER' },
    });
    if (!buyerRole) {
      throw new Error('BUYER role not found');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      roleId: buyerRole.id,
      isEmailVerified: true,
      createdBy: 'system',
    });
    return this.userRepository.save(user);
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}

describe('Auth Integration Tests', () => {
  let service: TestAuthService;
  let module: TestingModule;

  const typeOrmConfig = {
    type: 'sqljs' as const,
    entities: [User, Role, Permission, DataPool],
    synchronize: true,
    logging: false,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        TypeOrmModule.forRoot(typeOrmConfig),
        TypeOrmModule.forFeature([User, Role]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [TestAuthService],
    }).compile();

    service = module.get<TestAuthService>(TestAuthService);

    // Seed BUYER role
    const roleRepo = module.get<Repository<Role>>(
      'RoleRepository' as unknown as string,
    );
    if (roleRepo) {
      const existing = await roleRepo.findOne({ where: { name: 'BUYER' } });
      if (!existing) {
        await roleRepo.save({ name: 'BUYER', isSystem: true });
      }
    }
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  describe('User Signup', () => {
    it('should create a new user', async () => {
      const dto: RegisterUserDto = {
        email: 'signup-test@example.com',
        password: 'Password123',
        fullName: 'Signup Test User',
      };

      const user = await service.signup(dto);
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('signup-test@example.com');
      expect(user.roleId).toBeDefined();
      expect(user.isEmailVerified).toBe(true);
    });

    it('should reject duplicate email', async () => {
      const dto: RegisterUserDto = {
        email: 'signup-test@example.com',
        password: 'Password456',
        fullName: 'Duplicate User',
      };

      await expect(service.signup(dto)).rejects.toThrow('Email already exists');
    });

    it('should create user with minimal fields', async () => {
      const dto: RegisterUserDto = {
        email: 'minimal@example.com',
        password: 'Pass123',
        fullName: 'Minimal',
      };

      const user = await service.signup(dto);
      expect(user.email).toBe('minimal@example.com');
      expect(user.isEmailVerified).toBe(true);
    });

    it('should hash the password', async () => {
      const dto: RegisterUserDto = {
        email: 'password-hash@example.com',
        password: 'MySecretPassword',
        fullName: 'Password Test',
      };

      const user = await service.signup(dto);
      expect(user.password).not.toBe('MySecretPassword');
      expect(user.password).toContain('$2b$'); // bcrypt hash prefix
    });
  });

  describe('Credential Validation', () => {
    it('should validate correct credentials', async () => {
      const user = await service.validateCredentials(
        'signup-test@example.com',
        'Password123',
      );
      expect(user).not.toBeNull();
      expect(user!.email).toBe('signup-test@example.com');
    });

    it('should reject wrong password', async () => {
      const user = await service.validateCredentials(
        'signup-test@example.com',
        'WrongPassword',
      );
      expect(user).toBeNull();
    });

    it('should reject non-existent email', async () => {
      const user = await service.validateCredentials(
        'nonexistent@example.com',
        'Password123',
      );
      expect(user).toBeNull();
    });
  });

  describe('User Lookup', () => {
    it('should find user by ID', async () => {
      const users = await module
        .get<Repository<User>>('UserRepository' as unknown as string)
        .find({ take: 1 });
      const user = await service.findUserById(users[0].id);
      expect(user).not.toBeNull();
      expect(user!.id).toBe(users[0].id);
    });

    it('should return null for non-existent ID', async () => {
      const user = await service.findUserById(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(user).toBeNull();
    });
  });
});
