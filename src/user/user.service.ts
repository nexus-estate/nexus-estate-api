import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "./entities/user.entity";
import { Repository } from "typeorm";
import { RegisterUserDto } from "./dto/create-user-dto";
import { UpdateUserDto } from "./dto/update-user-dto";
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    /**
     * === CREATE ===
     * Create + hash password
     * use pessimistic lock để tránh race condition
     */
    async handleSignUp(createUserDto: RegisterUserDto): Promise<User> {
        const queryRunner = this.userRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Check email tồn tại (với lock)
            const existingUser = await queryRunner.manager.findOne(User, {
                where: { email: createUserDto.email },
                lock: { mode: 'pessimistic_write' },
            });

            if (existingUser) {
                throw new ConflictException('Email already exists');
            }

            // 2. Create
            const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

            // 3. Tạo user mới
            const user = this.userRepository.create({
                email: createUserDto.email,
                password: hashedPassword,
                fullName: createUserDto.fullName,
                phoneNumber: createUserDto.phoneNumber,
                avatar: createUserDto.avatar,
                bio: createUserDto.bio,
                role: UserRole.BUYER,
                isEmailVerified: true,
            });

            const savedUser = await queryRunner.manager.save(user);
            await queryRunner.commitTransaction();

            this.logger.log(`User created: ${savedUser.email}`);
            return savedUser;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to create user: ${this.getErrorMessage(error)}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * === READ ONE ===
     * Lấy user theo ID
     */
    async handleFindOne(id: string): Promise<User> {
        try {
            const user = await this.userRepository.findOne({ where: { id } });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            return user;
        } catch (error) {
            this.logger.error(`Failed to find user ${id}: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }

    /**
     * === READ BY EMAIL ===
      * Auth sẽ dùng method này để tìm user khi login
      */
    async handleFindByEmail(email: string): Promise<User | null> {
        try {
            const user = await this.userRepository.findOne({ where: { email } });
            return user;
        } catch (error) {
            this.logger.error(`Failed to find user by email: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }

    /**
     * === UPDATE ===
     * Update user Infor 
     */
    async handleUpdate(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const queryRunner = this.userRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Lấy user với version lock
            const user = await queryRunner.manager.findOne(User, {
                where: { id },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // 2. Update fields
            if (updateUserDto.fullName) user.fullName = updateUserDto.fullName;
            if (updateUserDto.phoneNumber) user.phoneNumber = updateUserDto.phoneNumber;
            if (updateUserDto.avatar) user.avatar = updateUserDto.avatar;
            if (updateUserDto.bio) user.bio = updateUserDto.bio;

            const updatedUser = await queryRunner.manager.save(user);
            await queryRunner.commitTransaction();

            this.logger.log(`User updated: ${updatedUser.id}`);
            return updatedUser;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to update user ${id}: ${this.getErrorMessage(error)}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * === DELETE ===
     * Xoá user
     */
    async handleRemove(id: string): Promise<{ message: string }> {
        const queryRunner = this.userRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await queryRunner.manager.findOne(User, {
                where: { id },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            await queryRunner.manager.remove(user);
            await queryRunner.commitTransaction();

            this.logger.log(`User deleted: ${id}`);
            return { message: 'User deleted successfully' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to delete user ${id}: ${this.getErrorMessage(error)}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * === VALIDATE PASSWORD ===
     * Auth sẽ dùng method này để verify password
     */
    async handleValidatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            this.logger.error(`Failed to validate password: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }

    /**
     * === CHANGE PASSWORD ===
     * Đổi mật khẩu user
     */
    async handleChangePassword(
        id: string,
        oldPassword: string,
        newPassword: string,
    ): Promise<{ message: string }> {
        const queryRunner = this.userRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await queryRunner.manager.findOne(User, {
                where: { id },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Verify old password
            const isPasswordValid = await this.handleValidatePassword(oldPassword, user.password);
            if (!isPasswordValid) {
                throw new BadRequestException('Old password is incorrect');
            }

            // Hash new password
            user.password = await bcrypt.hash(newPassword, 10);

            await queryRunner.manager.save(user);
            await queryRunner.commitTransaction();

            this.logger.log(`Password changed for user: ${id}`);
            return { message: 'Password changed successfully' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to change password for user ${id}: ${this.getErrorMessage(error)}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}