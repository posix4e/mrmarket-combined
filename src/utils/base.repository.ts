import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from './redis.service';

@Injectable()
export class BaseRepository<T extends { id: string }> {
  constructor(
    protected readonly redisService: RedisService,
    protected readonly prefix: string,
  ) {}

  protected getKey(id: string): string {
    return `${this.prefix}:${id}`;
  }

  protected getCollectionKey(): string {
    return `${this.prefix}:all`;
  }

  async findById(id: string): Promise<T | null> {
    return await this.redisService.get<T>(this.getKey(id));
  }

  async findAll(): Promise<T[]> {
    const ids = await this.redisService.smembers(this.getCollectionKey());
    if (!ids.length) return [];

    const entities: T[] = [];
    for (const id of ids) {
      const entity = await this.findById(id);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const id = uuidv4();
    const entity = { ...data, id } as T;
    
    await this.redisService.set(this.getKey(id), entity);
    await this.redisService.sadd(this.getCollectionKey(), id);
    
    return entity;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const entity = await this.findById(id);
    if (!entity) return null;

    const updatedEntity = { ...entity, ...data } as T;
    await this.redisService.set(this.getKey(id), updatedEntity);
    
    return updatedEntity;
  }

  async delete(id: string): Promise<boolean> {
    const exists = await this.findById(id);
    if (!exists) return false;

    await this.redisService.del(this.getKey(id));
    await this.redisService.srem(this.getCollectionKey(), id);
    
    return true;
  }

  async findBy(field: keyof T, value: any): Promise<T[]> {
    const entities = await this.findAll();
    return entities.filter(entity => entity[field] === value);
  }
}