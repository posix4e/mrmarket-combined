import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = new Redis(redisUrl);
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  getClient(): Redis {
    return this.redisClient;
  }

  async set(key: string, value: any, expireSeconds?: number): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (expireSeconds) {
      await this.redisClient.set(key, stringValue, 'EX', expireSeconds);
    } else {
      await this.redisClient.set(key, stringValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.redisClient.keys(pattern);
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await this.redisClient.hset(key, field, stringValue);
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.redisClient.hget(key, field);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    const result = await this.redisClient.hgetall(key);
    if (!result || Object.keys(result).length === 0) return null;
    
    const parsedResult: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(result)) {
      try {
        parsedResult[field] = JSON.parse(value) as T;
      } catch {
        parsedResult[field] = value as unknown as T;
      }
    }
    
    return parsedResult;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redisClient.hdel(key, field);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redisClient.expire(key, seconds);
  }

  async incr(key: string): Promise<number> {
    return await this.redisClient.incr(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.redisClient.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.redisClient.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.redisClient.srem(key, ...members);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.redisClient.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redisClient.zrange(key, start, stop);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return await this.redisClient.zrem(key, ...members);
  }
}