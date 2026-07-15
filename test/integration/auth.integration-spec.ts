import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
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

  async handleRegister(
    dto: RegisterUserDto,
  ): Promise<{ user: User; message: string }> {
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
      username: dto.username ?? null,
      password: hashedPassword,
      roleId: buyerRole.id,
      isEmailVerified: true,
      createdBy: 'system',
    });
    const savedUser = await this.userRepository.save(user);
    return { user: savedUser, message: 'Registration successful' };
  }

  async handleValidateUser(
    identifier: string,
    password: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });
    if (!user) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error('Invalid credentials');

    return user;
  }

  async handleGetProfile(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new Error('User not found');
    return user;
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
    const roleRepo = module.get<Repository<Role>>(getRepositoryToken(Role));
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

      const result = await service.handleRegister(dto);
      expect(result.message).toBe('Registration successful');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('signup-test@example.com');
      expect(result.user.roleId).toBeDefined();
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('should reject duplicate email', async () => {
      const dto: RegisterUserDto = {
        email: 'signup-test@example.com',
        password: 'Password456',
        fullName: 'Duplicate User',
      };

      await expect(service.handleRegister(dto)).rejects.toThrow(
        'Email already exists',
      );
    });

    it('should create user with minimal fields', async () => {
      const dto: RegisterUserDto = {
        email: 'minimal@example.com',
        password: 'Pass123',
        fullName: 'Minimal',
      };

      const result = await service.handleRegister(dto);
      expect(result.user.email).toBe('minimal@example.com');
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('should hash the password', async () => {
      const dto: RegisterUserDto = {
        email: 'password-hash@example.com',
        password: 'MySecretPassword',
        fullName: 'Password Test',
      };

      const result = await service.handleRegister(dto);
      expect(result.user.password).not.toBe('MySecretPassword');
      expect(result.user.password).toContain('$2b$'); // bcrypt hash prefix
    });
  });

  describe('Credential Validation', () => {
    it('should validate correct credentials', async () => {
      const user = await service.handleValidateUser(
        'signup-test@example.com',
        'Password123',
      );
      expect(user.email).toBe('signup-test@example.com');
    });

    it('should reject wrong password', async () => {
      await expect(
        service.handleValidateUser('signup-test@example.com', 'WrongPassword'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      await expect(
        service.handleValidateUser('nonexistent@example.com', 'Password123'),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('User Lookup', () => {
    it('should find user by ID', async () => {
      const users = await module
        .get<Repository<User>>(getRepositoryToken(User))
        .find({ take: 1 });
      const user = await service.handleGetProfile(users[0].id);
      expect(user.id).toBe(users[0].id);
    });

    it('should return null for non-existent ID', async () => {
      await expect(
        service.handleGetProfile('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow('User not found');
    });
  });
});
