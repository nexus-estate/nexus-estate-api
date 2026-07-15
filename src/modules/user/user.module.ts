import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { DataPoolService } from './services/data-pool.service';
import { UserController } from './controllers/user.controller';
import { UserRepository } from './repositories/user.repository';
import { DataPool } from './entities/data-pool.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DataPool])],
  controllers: [UserController],
  providers: [UserService, UserRepository, DataPoolService],
  exports: [UserService, DataPoolService],
})
export class UserModule {}
