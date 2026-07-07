import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { RegisterUserDto } from '../user/dto/create-user-dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
    ) { }

   
    async handleValidateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userService.handleFindByEmail(email);
        if (!user) {
            this.logger.warn(`User not found: ${email}`);
            return null;
        }

        const isPasswordValid = await this.userService.handleValidatePassword(password, user.password);
        if (!isPasswordValid) {
            this.logger.warn(`Invalid password: ${email}`);
            return null;
        }

        this.logger.log(`User validated: ${email}`);
        return user;
    }

  
    async handleSignup(dto: RegisterUserDto): Promise<{ user: User; message: string }> {
        const user = await this.userService.handleSignUp(dto);
        this.logger.log(`User created: ${user.email}`);
        return { user, message: 'Signup successful' };
    }

  
    async handleSignin(user: User): Promise<{ user: User; accessToken: string; expiresIn: string }> {
        user.lastLogin = new Date();
        await this.userService.handleUpdate(user.id, { lastLogin: user.lastLogin });  // ← Sửa đây

        const accessToken = await this.handleGenerateToken(user.id);
        this.logger.log(`User signed in: ${user.email}`);

        return { user, accessToken, expiresIn: '365d' };
    }

 
    async handleGenerateToken(userId: string): Promise<string> {
        const token = await this.jwtService.signAsync(
            { sub: userId },
            { expiresIn: '365d', secret: process.env.JWT_SECRET },
        );
        this.logger.log(`Token generated for user: ${userId}`);
        return token;
    }

 
    async handleValidateToken(token: string): Promise<{ sub: string }> {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
            });
            this.logger.log(`Token validated for user: ${payload.sub}`);
            return { sub: payload.sub };
        } catch (error) {
            this.logger.error(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}