import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../utils/base.repository';
import { ExchangeApiKey } from '../../interfaces/exchange.interface';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class ExchangeApiKeyRepository extends BaseRepository<ExchangeApiKey> {
  constructor(redisService: RedisService) {
    super(redisService, 'exchange_api_key');
  }

  async findByUserIdAndExchange(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeApiKey[]> {
    const apiKeys = await this.findBy('userId', userId);
    return apiKeys.filter(key => key.exchangeName === exchangeName);
  }

  async findDefaultByUserIdAndExchange(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeApiKey | null> {
    const apiKeys = await this.findByUserIdAndExchange(userId, exchangeName);
    return apiKeys.find(key => key.isDefault) || null;
  }
}