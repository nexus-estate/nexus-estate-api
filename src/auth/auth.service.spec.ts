import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/entities/user.entity';
import { RegisterUserDto } from '../user/dto/create-user-dto';

describe('AuthService (Unit Tests)', () => {
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  // Mock user object
  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashed_password_123',
    fullName: 'John Doe',
    phoneNumber: '1234567890',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    role: UserRole.BUYER,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
    version: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            handleFindByEmail: jest.fn(),
            handleValidatePassword: jest.fn(),
            handleSignUp: jest.fn(),
            handleUpdate: jest.fn(),
            handleFindOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleValidateUser', () => {
    it('should return user when credentials are valid', async () => {
      jest.spyOn(userService, 'handleFindByEmail').mockResolvedValue(mockUser);
      jest
        .spyOn(userService, 'handleValidatePassword')
        .mockResolvedValue(true);

      const result = await authService.handleValidateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual(mockUser);
      expect(userService.handleFindByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(userService.handleValidatePassword).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
    });

    it('should return null when user not found', async () => {
      jest.spyOn(userService, 'handleFindByEmail').mockResolvedValue(null);

      const result = await authService.handleValidateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      jest.spyOn(userService, 'handleFindByEmail').mockResolvedValue(mockUser);
      jest
        .spyOn(userService, 'handleValidatePassword')
        .mockResolvedValue(false);

      const result = await authService.handleValidateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('should throw error when userService fails', async () => {
      jest
        .spyOn(userService, 'handleFindByEmail')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        authService.handleValidateUser('test@example.com', 'password123'),
      ).rejects.toThrow('Database error');
    });
  });

  describe('handleSignup', () => {
    it('should create user and return signup response', async () => {
      const registerDto: RegisterUserDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      const newUser = { ...mockUser, email: registerDto.email };

      jest.spyOn(userService, 'handleSignUp').mockResolvedValue(newUser);

      const result = await authService.handleSignup(registerDto);

      expect(result.user).toEqual(newUser);
      expect(result.message).toBe('Signup successful');
      expect(userService.handleSignUp).toHaveBeenCalledWith(registerDto);
    });

    it('should throw error when email already exists', async () => {
      const registerDto: RegisterUserDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      jest
        .spyOn(userService, 'handleSignUp')
        .mockRejectedValue(new Error('Email already exists'));

      await expect(authService.handleSignup(registerDto)).rejects.toThrow(
        'Email already exists',
      );
    });

    it('should throw error when user creation fails', async () => {
      const registerDto: RegisterUserDto = {
        email: 'error@example.com',
        password: 'password123',
        fullName: 'Error User',
      };

      jest
        .spyOn(userService, 'handleSignUp')
        .mockRejectedValue(new Error('Creation failed'));

      await expect(authService.handleSignup(registerDto)).rejects.toThrow(
        'Creation failed',
      );
    });
  });

  describe('handleSignin', () => {
    it('should return user with token after signin', async () => {
      const token = 'jwt_token_123456789';
      const mockUpdatedUser = { ...mockUser };

      jest.spyOn(userService, 'handleUpdate').mockResolvedValue(mockUpdatedUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const result = await authService.handleSignin(mockUser);

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe(token);
      expect(result.expiresIn).toBe('365d');
      expect(userService.handleUpdate).toHaveBeenCalled();
    });

    it('should update lastLogin when signin', async () => {
      const token = 'jwt_token_123456789';

      jest.spyOn(userService, 'handleUpdate').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const user = { ...mockUser, lastLogin: null };
      await authService.handleSignin(user);

      const updateCall = (userService.handleUpdate as jest.Mock).mock.calls[0];
      expect(updateCall[0]).toBe(mockUser.id);
      expect(updateCall[1]).toHaveProperty('lastLogin');
      expect(updateCall[1].lastLogin).not.toBeNull();
    });

    it('should generate token with 365d expiration', async () => {
      const token = 'jwt_token_123456789';

      jest.spyOn(userService, 'handleUpdate').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      await authService.handleSignin(mockUser);

      const signCall = (jwtService.signAsync as jest.Mock).mock.calls[0];
      expect(signCall[0]).toEqual({ sub: mockUser.id });
      expect(signCall[1]).toHaveProperty('expiresIn', '365d');
    });

    it('should throw error when update fails', async () => {
      jest
        .spyOn(userService, 'handleUpdate')
        .mockRejectedValue(new Error('Update failed'));

      await expect(authService.handleSignin(mockUser)).rejects.toThrow(
        'Update failed',
      );
    });

    it('should throw error when token generation fails', async () => {
      jest
        .spyOn(userService, 'handleUpdate')
        .mockResolvedValue(mockUser);
      jest
        .spyOn(jwtService, 'signAsync')
        .mockRejectedValue(new Error('Token generation failed'));

      await expect(authService.handleSignin(mockUser)).rejects.toThrow(
        'Token generation failed',
      );
    });
  });

  describe('handleGenerateToken', () => {
    it('should generate valid JWT token', async () => {
      const token = 'jwt_token_123456789';
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const result = await authService.handleGenerateToken(mockUser.id);

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: mockUser.id },
        expect.objectContaining({
          expiresIn: '365d',
          secret: process.env.JWT_SECRET,
        }),
      );
    });

    it('should use correct payload structure', async () => {
      const token = 'jwt_token_123456789';
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      await authService.handleGenerateToken(mockUser.id);

      const callArgs = (jwtService.signAsync as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toEqual({ sub: mockUser.id });
    });

    it('should throw error when token generation fails', async () => {
      jest
        .spyOn(jwtService, 'signAsync')
        .mockRejectedValue(new Error('Signing failed'));

      await expect(
        authService.handleGenerateToken(mockUser.id),
      ).rejects.toThrow('Signing failed');
    });
  });

  describe('handleValidateToken', () => {
    it('should validate token and return payload', async () => {
      const token = 'valid_jwt_token';
      const payload = { sub: mockUser.id };

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

      const result = await authService.handleValidateToken(token);

      expect(result).toEqual({ sub: mockUser.id });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: process.env.JWT_SECRET,
      });
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      const token = 'invalid_token';

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Invalid signature'));

      await expect(authService.handleValidateToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.handleValidateToken(token)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const token = 'expired_token';

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Token expired'));

      await expect(authService.handleValidateToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle any verification error', async () => {
      const token = 'bad_token';

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Some error'));

      await expect(authService.handleValidateToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should complete full signin flow', async () => {
      const token = 'jwt_token_365days';

      jest.spyOn(userService, 'handleFindByEmail').mockResolvedValue(mockUser);
      jest
        .spyOn(userService, 'handleValidatePassword')
        .mockResolvedValue(true);
      jest.spyOn(userService, 'handleUpdate').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      // Step 1: Validate user
      const validatedUser = await authService.handleValidateUser(
        'test@example.com',
        'password123',
      );
      expect(validatedUser).toEqual(mockUser);

      // Step 2: Signin
      const signinResult = await authService.handleSignin(validatedUser);
      expect(signinResult.accessToken).toBe(token);
      expect(signinResult.expiresIn).toBe('365d');
    });

    it('should handle signup -> signin flow', async () => {
      const registerDto: RegisterUserDto = {
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };
      const token = 'jwt_token_new_user';
      const newUser = { ...mockUser, email: registerDto.email };

      jest.spyOn(userService, 'handleSignUp').mockResolvedValue(newUser);
      jest.spyOn(userService, 'handleUpdate').mockResolvedValue(newUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      // Step 1: Signup
      const signupResult = await authService.handleSignup(registerDto);
      expect(signupResult.user.email).toBe(registerDto.email);
      expect(signupResult.message).toBe('Signup successful');

      // Step 2: Signin
      const signinResult = await authService.handleSignin(signupResult.user);
      expect(signinResult.accessToken).toBe(token);
    });
  });
});