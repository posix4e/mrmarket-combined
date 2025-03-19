import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../utils/base.repository';
import { User } from '../../interfaces/user.interface';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(redisService: RedisService) {
    super(redisService, 'user');
  }

  async findByUsername(username: string): Promise<User | null> {
    const users = await this.findAll();
    return users.find(user => user.username === username) || null;
  }
}