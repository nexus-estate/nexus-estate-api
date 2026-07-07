import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserService } from './user.service';
import { User, UserRole } from './entities/user.entity';
import { RegisterUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('UserService Integration Tests', () => {
  let service: UserService;
  let module: TestingModule;

  // SQLite in-memory database for testing
  const typeOrmConfig = {
    type: 'sqlite',
    database: ':memory:',
    entities: [User],
    synchronize: true,
    logging: false,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forRoot(typeOrmConfig as any),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('User CRUD Operations', () => {
    let createdUserId: string;
    let testEmail: string = 'integration-test@example.com';

    it('should create a new user with all fields', async () => {
      const registerUserDto: RegisterUserDto = {
        email: testEmail,
        password: 'TestPassword123',
        fullName: 'Integration Test User',
        phoneNumber: '1234567890',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Test bio for integration',
      };

      const result = await service.handleCreate(registerUserDto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(testEmail);
      expect(result.fullName).toBe('Integration Test User');
      expect(result.phoneNumber).toBe('1234567890');
      expect(result.role).toBe(UserRole.BUYER);
      expect(result.isActive).toBe(true);
      expect(result.isEmailVerified).toBe(true);
      createdUserId = result.id;
    });

    it('should create user with only required fields', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'minimal@example.com',
        password: 'TestPassword123',
        fullName: 'Minimal User',
      };

      const result = await service.handleCreate(registerUserDto);

      expect(result.email).toBe('minimal@example.com');
      expect(result.fullName).toBe('Minimal User');
      expect(result.phoneNumber).toBeNull();
      expect(result.avatar).toBeNull();
    });

    it('should throw ConflictException when creating duplicate email', async () => {
      const registerUserDto: RegisterUserDto = {
        email: testEmail,
        password: 'AnotherPassword123',
        fullName: 'Another User',
      };

      await expect(service.handleCreate(registerUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should find user by id', async () => {
      const result = await service.handleFindOne(createdUserId);

      expect(result.id).toBe(createdUserId);
      expect(result.email).toBe(testEmail);
      expect(result.fullName).toBe('Integration Test User');
    });

    it('should throw NotFoundException when finding non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(service.handleFindOne(fakeId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should find user by email', async () => {
      const result = await service.handleFindByEmail(testEmail);

      expect(result.email).toBe(testEmail);
      expect(result.id).toBe(createdUserId);
    });

    it('should return null when finding non-existent email', async () => {
      const result = await service.handleFindByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should update user fields successfully', async () => {
      const updateUserDto: UpdateUserDto = {
        fullName: 'Updated Integration User',
        phoneNumber: '9876543210',
        bio: 'Updated bio',
      };

      const result = await service.handleUpdate(createdUserId, updateUserDto);

      expect(result.fullName).toBe('Updated Integration User');
      expect(result.phoneNumber).toBe('9876543210');
      expect(result.bio).toBe('Updated bio');
      expect(result.email).toBe(testEmail);
    });

    it('should update only specified fields', async () => {
      const updateUserDto: UpdateUserDto = {
        fullName: 'Partial Update',
      };

      const result = await service.handleUpdate(createdUserId, updateUserDto);

      expect(result.fullName).toBe('Partial Update');
      expect(result.phoneNumber).toBe('9876543210');
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Should Not Update',
      };

      await expect(service.handleUpdate(fakeId, updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Password Operations', () => {
    let userWithPassword: User;
    const testPassword = 'TestPassword123';

    beforeAll(async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'password-test@example.com',
        password: testPassword,
        fullName: 'Password Test User',
      };

      userWithPassword = await service.handleCreate(registerUserDto);
    });

    it('should validate correct password', async () => {
      const isValid = await service.handleValidatePassword(
        testPassword,
        userWithPassword.password,
      );

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const isValid = await service.handleValidatePassword(
        'WrongPassword123',
        userWithPassword.password,
      );

      expect(isValid).toBe(false);
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword456';

      const result = await service.handleChangePassword(
        userWithPassword.id,
        testPassword,
        newPassword,
      );

      expect(result.message).toBe('Password changed successfully');

      const isNewPasswordValid = await service.handleValidatePassword(
        newPassword,
        userWithPassword.password,
      );
      expect(isNewPasswordValid).toBe(true);
    });

    it('should throw BadRequestException with wrong old password', async () => {
      await expect(
        service.handleChangePassword(
          userWithPassword.id,
          'WrongOldPassword',
          'NewPassword789',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when changing password for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        service.handleChangePassword(fakeId, testPassword, 'NewPassword'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Delete Operations', () => {
    let userToDelete: User;

    beforeAll(async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'delete-test@example.com',
        password: 'TestPassword123',
        fullName: 'User To Delete',
      };

      userToDelete = await service.handleCreate(registerUserDto);
    });

    it('should delete user successfully', async () => {
      const result = await service.handleRemove(userToDelete.id);

      expect(result.message).toBe('User deleted successfully');
    });

    it('should not find deleted user', async () => {
      await expect(service.handleFindOne(userToDelete.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when deleting non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(service.handleRemove(fakeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent creates without duplicate emails', async () => {
      const email = 'concurrent-test@example.com';
      const registerUserDto1: RegisterUserDto = {
        email,
        password: 'Password1',
        fullName: 'User 1',
      };

      const registerUserDto2: RegisterUserDto = {
        email,
        password: 'Password2',
        fullName: 'User 2',
      };

      const results = await Promise.allSettled([
        service.handleCreate(registerUserDto1),
        service.handleCreate(registerUserDto2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      expect(fulfilled).toBe(1);
      expect(rejected).toBe(1);
    });

    it('should handle sequential updates correctly', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'sequential-update@example.com',
        password: 'TestPassword123',
        fullName: 'Initial Name',
      };

      const user = await service.handleCreate(registerUserDto);

      const update1 = await service.handleUpdate(user.id, {
        fullName: 'Updated Name 1',
      });
      expect(update1.fullName).toBe('Updated Name 1');

      const update2 = await service.handleUpdate(user.id, {
        fullName: 'Updated Name 2',
      });
      expect(update2.fullName).toBe('Updated Name 2');

      const final = await service.handleFindOne(user.id);
      expect(final.fullName).toBe('Updated Name 2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with minimal data', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'minimal-edge@example.com',
        password: 'Pass123',
        fullName: 'M',
      };

      const result = await service.handleCreate(registerUserDto);

      expect(result.fullName).toBe('M');
      expect(result.phoneNumber).toBeNull();
      expect(result.avatar).toBeNull();
      expect(result.bio).toBeNull();
    });

    it('should handle empty optional fields during update', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'empty-update@example.com',
        password: 'Password123',
        fullName: 'Test User',
        phoneNumber: '1234567890',
        bio: 'Original bio',
      };

      const user = await service.handleCreate(registerUserDto);

      const updateUserDto: UpdateUserDto = {
        fullName: 'Updated',
      };

      const result = await service.handleUpdate(user.id, updateUserDto);

      expect(result.fullName).toBe('Updated');
      expect(result.phoneNumber).toBe('1234567890');
      expect(result.bio).toBe('Original bio');
    });

    it('should preserve timestamps on user creation', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'timestamp@example.com',
        password: 'Password123',
        fullName: 'Timestamp Test',
      };

      const result = await service.handleCreate(registerUserDto);

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt).toEqual(result.updatedAt);
    });

    it('should update updatedAt when user is modified', async () => {
      const registerUserDto: RegisterUserDto = {
        email: 'update-timestamp@example.com',
        password: 'Password123',
        fullName: 'Update Timestamp Test',
      };

      const created = await service.handleCreate(registerUserDto);
      const createdTime = created.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const updated = await service.handleUpdate(created.id, {
        fullName: 'Updated Name',
      });
      const updatedTime = updated.updatedAt.getTime();

      expect(updatedTime).toBeGreaterThanOrEqual(createdTime);
    });
  });
});
