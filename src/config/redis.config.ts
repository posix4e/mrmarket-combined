import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisConfig {
  constructor(private configService: ConfigService) {}

  createRedisClient(): Redis {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    return new Redis(redisUrl);
  }
}