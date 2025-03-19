import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { RedisService } from '../../utils/redis.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository, RedisService],
  exports: [UserService],
})
export class UserModule {}